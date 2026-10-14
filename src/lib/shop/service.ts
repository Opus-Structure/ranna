import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit/log";
import { AccountLockedError, assertCanEdit } from "@/lib/billing/access";
import { serviceDb, withRls } from "@/lib/db/client";
import { merchants, slugRedirects } from "@/lib/db/schema";
import type { MerchantBranding, MerchantSettings } from "@/lib/db/schema/types";
import type { MerchantContext } from "@/lib/merchants/context";
import { removeObject } from "@/lib/storage/objects";
import {
  brandingSchema,
  openingHoursSchema,
  orderingSettingsSchema,
  regionalSchema,
  shopProfileSchema,
  slugSchema,
} from "@/lib/validation/shop";
import { invalidateShop } from "./cache";

export type ShopFail = { ok: false; error: string; field?: string };
export type ShopResult<T = undefined> = { ok: true; data?: T } | ShopFail;

function firstIssue(error: { issues: { message: string; path: PropertyKey[] }[] }): ShopFail {
  const issue = error.issues[0];
  return {
    ok: false,
    error: issue?.message ?? "invalid",
    field: issue?.path.map(String).join("."),
  };
}

async function guarded<T>(
  ctx: MerchantContext,
  run: () => Promise<ShopResult<T>>,
): Promise<ShopResult<T>> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  try {
    assertCanEdit(ctx);
    return await run();
  } catch (err) {
    if (err instanceof AccountLockedError) return { ok: false, error: "locked" };
    throw err;
  }
}

export async function updateShopProfile(ctx: MerchantContext, input: unknown) {
  return guarded(ctx, async () => {
    const parsed = shopProfileSchema.safeParse(input);
    if (!parsed.success) return firstIssue(parsed.error);
    await withRls(ctx.user.id, (tx) =>
      tx.update(merchants).set(parsed.data).where(eq(merchants.id, ctx.merchant.id)),
    );
    invalidateShop(ctx.merchant.id, ctx.merchant.slug);
    return { ok: true };
  });
}

/** Saves colours, font, layout and welcome text. Image paths come from uploads already checked. */
export async function updateBranding(
  ctx: MerchantContext,
  input: unknown,
  images: { logoPath?: string | null; coverPath?: string | null },
) {
  return guarded(ctx, async () => {
    const parsed = brandingSchema.safeParse(input);
    if (!parsed.success) return firstIssue(parsed.error);
    const prefix = `${ctx.merchant.id}/`;
    for (const path of [images.logoPath, images.coverPath]) {
      if (path && !path.startsWith(prefix)) return { ok: false, error: "forbidden" };
    }
    const replaced: string[] = [];
    await withRls(ctx.user.id, async (tx) => {
      const [current] = await tx
        .select({ branding: merchants.branding })
        .from(merchants)
        .where(eq(merchants.id, ctx.merchant.id));
      const prev: MerchantBranding = current?.branding ?? {};
      const next: MerchantBranding = {
        ...prev,
        ...parsed.data,
        ...(images.logoPath !== undefined ? { logoPath: images.logoPath } : {}),
        ...(images.coverPath !== undefined ? { coverPath: images.coverPath } : {}),
      };
      if (prev.logoPath && prev.logoPath !== next.logoPath) replaced.push(prev.logoPath);
      if (prev.coverPath && prev.coverPath !== next.coverPath) replaced.push(prev.coverPath);
      await tx.update(merchants).set({ branding: next }).where(eq(merchants.id, ctx.merchant.id));
    });
    // Old images are removed after the new branding is saved; failures only leave a stray file.
    await Promise.all(
      replaced.map((p) => removeObject("merchant-assets", p).catch(() => undefined)),
    );
    invalidateShop(ctx.merchant.id, ctx.merchant.slug);
    return { ok: true };
  });
}

async function mergeSettings(ctx: MerchantContext, patch: Partial<MerchantSettings>) {
  await withRls(ctx.user.id, (tx) =>
    tx
      .update(merchants)
      .set({ settings: sql`${merchants.settings} || ${JSON.stringify(patch)}::jsonb` })
      .where(eq(merchants.id, ctx.merchant.id)),
  );
  invalidateShop(ctx.merchant.id, ctx.merchant.slug);
}

export async function updateOpeningHours(ctx: MerchantContext, input: unknown) {
  return guarded(ctx, async () => {
    const parsed = openingHoursSchema.safeParse(input);
    if (!parsed.success) return firstIssue(parsed.error);
    await mergeSettings(ctx, { openingHours: parsed.data });
    return { ok: true };
  });
}

export async function updateOrderingSettings(ctx: MerchantContext, input: unknown) {
  return guarded(ctx, async () => {
    const parsed = orderingSettingsSchema.safeParse(input);
    if (!parsed.success) return firstIssue(parsed.error);
    await mergeSettings(ctx, parsed.data);
    return { ok: true };
  });
}

/** Open/closed and taking-orders switches. Staff may flip "taking orders" during a rush. */
export async function setShopToggles(
  ctx: MerchantContext,
  toggles: { isOpen?: boolean; acceptingOrders?: boolean },
): Promise<ShopResult> {
  try {
    assertCanEdit(ctx);
  } catch {
    return { ok: false, error: "locked" };
  }
  if (toggles.isOpen !== undefined && ctx.role !== "owner")
    return { ok: false, error: "forbidden" };
  const patch: { isOpen?: boolean; acceptingOrders?: boolean } = {};
  if (typeof toggles.isOpen === "boolean") patch.isOpen = toggles.isOpen;
  if (typeof toggles.acceptingOrders === "boolean") patch.acceptingOrders = toggles.acceptingOrders;
  if (Object.keys(patch).length === 0) return { ok: false, error: "invalid" };
  // Staff cannot UPDATE merchants under RLS; the role check above is the authorization here.
  await serviceDb.update(merchants).set(patch).where(eq(merchants.id, ctx.merchant.id));
  invalidateShop(ctx.merchant.id, ctx.merchant.slug);
  return { ok: true };
}

/**
 * Changes the public link. The old slug becomes a redirect so printed QR codes keep working;
 * a slug that is (or was) another shop's stays theirs.
 */
export async function changeSlug(
  ctx: MerchantContext,
  input: unknown,
): Promise<ShopResult<{ slug: string }>> {
  return guarded<{ slug: string }>(ctx, async () => {
    const parsed = slugSchema.safeParse(input);
    if (!parsed.success) return firstIssue(parsed.error);
    const slug = parsed.data;
    return serviceDb.transaction(async (tx) => {
      const [me] = await tx
        .select({ slug: merchants.slug })
        .from(merchants)
        .where(eq(merchants.id, ctx.merchant.id))
        .for("update");
      if (me?.slug === slug) return { ok: true, data: { slug } } as const;

      const [ownedByOther] = await tx
        .select({ id: merchants.id })
        .from(merchants)
        .where(and(eq(merchants.slug, slug), ne(merchants.id, ctx.merchant.id)));
      const [redirectedByOther] = await tx
        .select({ merchantId: slugRedirects.merchantId })
        .from(slugRedirects)
        .where(and(eq(slugRedirects.oldSlug, slug), ne(slugRedirects.merchantId, ctx.merchant.id)));
      if (ownedByOther || redirectedByOther)
        return { ok: false, error: "slug_taken", field: "slug" } as const;

      // Reclaiming one of our own old slugs: it stops being a redirect.
      await tx
        .delete(slugRedirects)
        .where(and(eq(slugRedirects.oldSlug, slug), eq(slugRedirects.merchantId, ctx.merchant.id)));
      if (me?.slug) {
        await tx
          .insert(slugRedirects)
          .values({ oldSlug: me.slug, merchantId: ctx.merchant.id })
          .onConflictDoUpdate({
            target: slugRedirects.oldSlug,
            set: { merchantId: ctx.merchant.id },
          });
      }
      await tx.update(merchants).set({ slug }).where(eq(merchants.id, ctx.merchant.id));
      await writeAudit(tx, {
        merchantId: ctx.merchant.id,
        actorUserId: ctx.user.id,
        actorType: "user",
        action: "shop.slug_changed",
        details: { from: me?.slug ?? null, to: slug },
      });
      invalidateShop(ctx.merchant.id, me?.slug, slug);
      return { ok: true, data: { slug } } as const;
    });
  });
}

export async function completeSetup(ctx: MerchantContext): Promise<ShopResult> {
  return guarded(ctx, async () => {
    const [m] = await serviceDb
      .select({ slug: merchants.slug })
      .from(merchants)
      .where(eq(merchants.id, ctx.merchant.id));
    if (!m?.slug) return { ok: false, error: "slugRequired", field: "slug" };
    await serviceDb
      .update(merchants)
      .set({ setupCompletedAt: new Date() })
      .where(eq(merchants.id, ctx.merchant.id));
    return { ok: true };
  });
}

export async function updateRegional(ctx: MerchantContext, input: unknown) {
  return guarded(ctx, async () => {
    const parsed = regionalSchema.safeParse(input);
    if (!parsed.success) return firstIssue(parsed.error);
    await withRls(ctx.user.id, (tx) =>
      tx.update(merchants).set(parsed.data).where(eq(merchants.id, ctx.merchant.id)),
    );
    invalidateShop(ctx.merchant.id, ctx.merchant.slug);
    return { ok: true };
  });
}
