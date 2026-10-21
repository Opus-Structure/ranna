import "server-only";
import { and, asc, count, eq, max, notInArray } from "drizzle-orm";
import { UNLIMITED_ITEMS } from "@/config/plans";
import { AccountLockedError, assertCanEdit } from "@/lib/billing/access";
import { serviceDb, withRls, type Tx } from "@/lib/db/client";
import { categories, items, merchants, optionGroups, options, plans } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { toMinor } from "@/lib/money";
import { invalidateShop } from "@/lib/shop/cache";
import { removeObject } from "@/lib/storage/objects";
import { categorySchema, itemSchema } from "@/lib/validation/menu";

export type MenuResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; field?: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function issue(error: { issues: { message: string; path: PropertyKey[] }[] }): MenuResult<never> {
  const first = error.issues[0];
  return {
    ok: false,
    error: first?.message ?? "invalid",
    field: first?.path.map(String).join("."),
  };
}

/** Owner + editable account, then the work runs as the owner with RLS enforced. */
async function asOwner<T>(
  ctx: MerchantContext,
  run: (tx: Tx) => Promise<MenuResult<T>>,
): Promise<MenuResult<T>> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  try {
    assertCanEdit(ctx);
  } catch (err) {
    if (err instanceof AccountLockedError) return { ok: false, error: "locked" };
    throw err;
  }
  const result = await withRls(ctx.user.id, run);
  if (result.ok) invalidateShop(ctx.merchant.id, ctx.merchant.slug);
  return result;
}

export type MenuOption = typeof options.$inferSelect;
export type MenuGroup = typeof optionGroups.$inferSelect & { options: MenuOption[] };
export type MenuItem = typeof items.$inferSelect & { optionGroups: MenuGroup[] };
export type MenuCategory = typeof categories.$inferSelect & { items: MenuItem[] };

/** The whole menu in display order, read through RLS (owner and staff). */
export async function loadMenu(userId: string, merchantId: string): Promise<MenuCategory[]> {
  return withRls(userId, async (tx) => {
    const cats = await tx
      .select()
      .from(categories)
      .where(eq(categories.merchantId, merchantId))
      .orderBy(asc(categories.sort), asc(categories.createdAt));
    const its = await tx
      .select()
      .from(items)
      .where(eq(items.merchantId, merchantId))
      .orderBy(asc(items.sort), asc(items.createdAt));
    const groups = await tx
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.merchantId, merchantId))
      .orderBy(asc(optionGroups.sort));
    const opts = await tx
      .select()
      .from(options)
      .where(eq(options.merchantId, merchantId))
      .orderBy(asc(options.sort));
    return assembleMenu(cats, its, groups, opts);
  });
}

export function assembleMenu(
  cats: (typeof categories.$inferSelect)[],
  its: (typeof items.$inferSelect)[],
  groups: (typeof optionGroups.$inferSelect)[],
  opts: MenuOption[],
): MenuCategory[] {
  const optionsByGroup = new Map<string, MenuOption[]>();
  for (const o of opts)
    optionsByGroup.set(o.groupId, [...(optionsByGroup.get(o.groupId) ?? []), o]);
  const groupsByItem = new Map<string, MenuGroup[]>();
  for (const g of groups) {
    groupsByItem.set(g.itemId, [
      ...(groupsByItem.get(g.itemId) ?? []),
      { ...g, options: optionsByGroup.get(g.id) ?? [] },
    ]);
  }
  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const i of its) {
    itemsByCategory.set(i.categoryId, [
      ...(itemsByCategory.get(i.categoryId) ?? []),
      { ...i, optionGroups: groupsByItem.get(i.id) ?? [] },
    ]);
  }
  return cats.map((c) => ({ ...c, items: itemsByCategory.get(c.id) ?? [] }));
}

export async function createCategory(
  ctx: MerchantContext,
  input: unknown,
): Promise<MenuResult<{ id: string }>> {
  return asOwner<{ id: string }>(ctx, async (tx) => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return issue(parsed.error);
    const [last] = await tx
      .select({ sort: max(categories.sort) })
      .from(categories)
      .where(eq(categories.merchantId, ctx.merchant.id));
    const [row] = await tx
      .insert(categories)
      .values({ ...parsed.data, merchantId: ctx.merchant.id, sort: (last?.sort ?? 0) + 10 })
      .returning({ id: categories.id });
    return { ok: true, data: { id: row!.id } };
  });
}

export async function updateCategory(
  ctx: MerchantContext,
  id: string,
  input: unknown,
): Promise<MenuResult> {
  if (!uuid.test(id)) return { ok: false, error: "invalid" };
  return asOwner<undefined>(ctx, async (tx) => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return issue(parsed.error);
    const rows = await tx
      .update(categories)
      .set(parsed.data)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  });
}

export async function deleteCategory(ctx: MerchantContext, id: string): Promise<MenuResult> {
  if (!uuid.test(id)) return { ok: false, error: "invalid" };
  const images: string[] = [];
  const result = await asOwner<undefined>(ctx, async (tx) => {
    const its = await tx
      .select({ imagePath: items.imagePath })
      .from(items)
      .where(eq(items.categoryId, id));
    for (const i of its) if (i.imagePath) images.push(i.imagePath);
    const rows = await tx
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  });
  if (result.ok)
    await Promise.all(images.map((p) => removeObject("merchant-assets", p).catch(() => undefined)));
  return result;
}

/** Persists a new order. Ids not owned by the merchant are filtered out by RLS. */
export async function reorderCategories(ctx: MerchantContext, ids: string[]): Promise<MenuResult> {
  if (!ids.every((i) => uuid.test(i)) || ids.length > 200) return { ok: false, error: "invalid" };
  return asOwner<undefined>(ctx, async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(categories)
        .set({ sort: (index + 1) * 10 })
        .where(eq(categories.id, id));
    }
    return { ok: true };
  });
}

export async function reorderItems(
  ctx: MerchantContext,
  categoryId: string,
  ids: string[],
): Promise<MenuResult> {
  if (!uuid.test(categoryId) || !ids.every((i) => uuid.test(i)) || ids.length > 500)
    return { ok: false, error: "invalid" };
  return asOwner<undefined>(ctx, async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(items)
        .set({ sort: (index + 1) * 10 })
        .where(and(eq(items.id, id), eq(items.categoryId, categoryId)));
    }
    return { ok: true };
  });
}

/** Platform admins run the platform: their shops are not capped, even without a plan. */
async function itemLimit(ctx: MerchantContext): Promise<number> {
  if (ctx.merchant.billingExempt) return UNLIMITED_ITEMS;
  const [row] = await serviceDb
    .select({ limits: plans.limits })
    .from(merchants)
    .innerJoin(plans, eq(plans.id, merchants.planId))
    .where(eq(merchants.id, ctx.merchant.id));
  return row?.limits.maxItems ?? 0;
}

/**
 * Creates or updates an item with its option groups in one transaction. Groups and options
 * missing from the input are deleted; prices arrive in major units and are stored in minor units.
 */
export async function saveItem(
  ctx: MerchantContext,
  input: unknown,
): Promise<MenuResult<{ id: string }>> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  const v = parsed.data;
  const currency = ctx.merchant.currency;
  const limit = v.id ? Infinity : await itemLimit(ctx);

  return asOwner<{ id: string }>(ctx, async (tx) => {
    const [cat] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, v.categoryId));
    if (!cat) return { ok: false, error: "not_found", field: "categoryId" };

    let itemId = v.id;
    const fields = {
      categoryId: v.categoryId,
      name: v.name,
      nameI18n: v.nameI18n,
      description: v.description,
      descriptionI18n: v.descriptionI18n,
      priceMinor: toMinor(v.price, currency),
      isAvailable: v.isAvailable,
    };
    if (itemId) {
      const rows = await tx
        .update(items)
        .set(fields)
        .where(eq(items.id, itemId))
        .returning({ id: items.id });
      if (!rows.length) return { ok: false, error: "not_found" };
    } else {
      const [total] = await tx
        .select({ n: count() })
        .from(items)
        .where(eq(items.merchantId, ctx.merchant.id));
      if (Number(total?.n ?? 0) >= limit) return { ok: false, error: "plan_limit" };
      const [last] = await tx
        .select({ sort: max(items.sort) })
        .from(items)
        .where(eq(items.categoryId, v.categoryId));
      const [row] = await tx
        .insert(items)
        .values({ ...fields, merchantId: ctx.merchant.id, sort: (last?.sort ?? 0) + 10 })
        .returning({ id: items.id });
      itemId = row!.id;
    }

    const keptGroupIds = v.optionGroups.map((g) => g.id).filter((id): id is string => Boolean(id));
    await tx
      .delete(optionGroups)
      .where(
        keptGroupIds.length
          ? and(eq(optionGroups.itemId, itemId), notInArray(optionGroups.id, keptGroupIds))
          : eq(optionGroups.itemId, itemId),
      );

    for (const [gi, g] of v.optionGroups.entries()) {
      const groupFields = {
        name: g.name,
        nameI18n: g.nameI18n,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sort: gi,
      };
      let groupId = g.id;
      if (groupId) {
        const rows = await tx
          .update(optionGroups)
          .set(groupFields)
          .where(and(eq(optionGroups.id, groupId), eq(optionGroups.itemId, itemId)))
          .returning({ id: optionGroups.id });
        if (!rows.length) groupId = undefined;
      }
      if (!groupId) {
        const [row] = await tx
          .insert(optionGroups)
          .values({ ...groupFields, itemId, merchantId: ctx.merchant.id })
          .returning({ id: optionGroups.id });
        groupId = row!.id;
      }
      const keptOptionIds = g.options.map((o) => o.id).filter((id): id is string => Boolean(id));
      await tx
        .delete(options)
        .where(
          keptOptionIds.length
            ? and(eq(options.groupId, groupId), notInArray(options.id, keptOptionIds))
            : eq(options.groupId, groupId),
        );
      for (const [oi, o] of g.options.entries()) {
        const optionFields = {
          name: o.name,
          nameI18n: o.nameI18n,
          priceDeltaMinor: toMinor(o.priceDelta, currency),
          isAvailable: o.isAvailable,
          sort: oi,
        };
        const updated = o.id
          ? await tx
              .update(options)
              .set(optionFields)
              .where(and(eq(options.id, o.id), eq(options.groupId, groupId)))
              .returning({ id: options.id })
          : [];
        if (!updated.length) {
          await tx
            .insert(options)
            .values({ ...optionFields, groupId, merchantId: ctx.merchant.id });
        }
      }
    }
    return { ok: true, data: { id: itemId } };
  });
}

export async function setItemAvailability(
  ctx: MerchantContext,
  id: string,
  available: boolean,
): Promise<MenuResult> {
  if (!uuid.test(id)) return { ok: false, error: "invalid" };
  return asOwner<undefined>(ctx, async (tx) => {
    const rows = await tx
      .update(items)
      .set({ isAvailable: available })
      .where(eq(items.id, id))
      .returning({ id: items.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  });
}

/** Points the item at an uploaded image (or none) and removes the previous file. */
export async function setItemImage(
  ctx: MerchantContext,
  id: string,
  path: string | null,
): Promise<MenuResult> {
  if (!uuid.test(id)) return { ok: false, error: "invalid" };
  if (path && !path.startsWith(`${ctx.merchant.id}/item/`))
    return { ok: false, error: "forbidden" };
  let previous: string | null = null;
  const result = await asOwner<undefined>(ctx, async (tx) => {
    const [row] = await tx
      .select({ imagePath: items.imagePath })
      .from(items)
      .where(eq(items.id, id));
    if (!row) return { ok: false, error: "not_found" };
    previous = row.imagePath;
    await tx.update(items).set({ imagePath: path }).where(eq(items.id, id));
    return { ok: true };
  });
  if (result.ok && previous && previous !== path)
    await removeObject("merchant-assets", previous).catch(() => undefined);
  return result;
}

export async function deleteItem(ctx: MerchantContext, id: string): Promise<MenuResult> {
  if (!uuid.test(id)) return { ok: false, error: "invalid" };
  let image: string | null = null;
  const result = await asOwner<undefined>(ctx, async (tx) => {
    const rows = await tx
      .delete(items)
      .where(eq(items.id, id))
      .returning({ imagePath: items.imagePath });
    if (!rows.length) return { ok: false, error: "not_found" };
    image = rows[0]!.imagePath;
    return { ok: true };
  });
  if (result.ok && image) await removeObject("merchant-assets", image).catch(() => undefined);
  return result;
}

/** Used by the menu page to show plan headroom. */
export async function itemUsage(ctx: MerchantContext): Promise<{ used: number; limit: number }> {
  const [row] = await serviceDb
    .select({ n: count() })
    .from(items)
    .where(eq(items.merchantId, ctx.merchant.id));
  return { used: Number(row?.n ?? 0), limit: await itemLimit(ctx) };
}
