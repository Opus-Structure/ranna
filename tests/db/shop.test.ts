/** Shop builder services against the real database (RLS, redirects, limits, public view). */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb } from "@/lib/db/client";
import {
  categories,
  items,
  merchantMembers,
  merchants,
  plans,
  slugRedirects,
} from "@/lib/db/schema";
import { createCategory, saveItem, updateCategory } from "@/lib/menu/service";
import type { MerchantContext } from "@/lib/merchants/context";
import { loadPublicShopUncached } from "@/lib/shop/public";
import { changeSlug, setShopToggles, updateBranding, updateShopProfile } from "@/lib/shop/service";
import { createAuthUser, deleteAuthUsers } from "./fixtures";

const users: string[] = [];
const merchantIds: string[] = [];
let planId: string;

async function owner(
  label: string,
  opts: { status?: "active" | "suspended"; role?: "owner" | "staff" } = {},
) {
  const userId = await createAuthUser(label);
  users.push(userId);
  const [m] = await serviceDb
    .insert(merchants)
    .values({
      name: `${label} shop`,
      slug: `${label}-${userId.slice(0, 6)}`,
      status: opts.status ?? "active",
      planId,
    })
    .returning();
  merchantIds.push(m!.id);
  await serviceDb.insert(merchantMembers).values({ merchantId: m!.id, userId, role: "owner" });
  const ctx: MerchantContext = {
    user: { id: userId, email: null, pendingShopName: null, locale: null },
    role: opts.role ?? "owner",
    merchant: {
      id: m!.id,
      name: m!.name,
      slug: m!.slug,
      status: m!.status,
      periodEnd: null,
      graceUntil: null,
      isOpen: true,
      acceptingOrders: true,
      currency: "DZD",
      timezone: "Africa/Algiers",
      defaultLocale: "ar",
      setupCompletedAt: null,
    },
  };
  return ctx;
}

beforeAll(async () => {
  const [p] = await serviceDb
    .insert(plans)
    .values({
      code: `shop-test-${randomUUID().slice(0, 8)}`,
      name: "Shop test",
      priceMinor: 100,
      limits: { maxItems: 2, maxStaff: 1, maxMonthlyOrders: null },
      isActive: false,
    })
    .returning({ id: plans.id });
  planId = p!.id;
});

afterAll(async () => {
  for (const id of merchantIds) await serviceDb.delete(merchants).where(eq(merchants.id, id));
  await serviceDb.delete(plans).where(eq(plans.id, planId));
  await deleteAuthUsers(users);
  await closeDb();
});

describe("slugs", () => {
  it("keeps the old link as a redirect and lets the owner take it back", async () => {
    const ctx = await owner("slug");
    const original = ctx.merchant.slug!;
    const fresh = `fresh-${randomUUID().slice(0, 6)}`;
    expect(await changeSlug(ctx, fresh)).toMatchObject({ ok: true });
    const [redirect] = await serviceDb
      .select()
      .from(slugRedirects)
      .where(eq(slugRedirects.oldSlug, original));
    expect(redirect?.merchantId).toBe(ctx.merchant.id);
    expect(await changeSlug(ctx, original)).toMatchObject({ ok: true });
    expect(
      await serviceDb.select().from(slugRedirects).where(eq(slugRedirects.oldSlug, original)),
    ).toHaveLength(0);
  });

  it("refuses slugs owned or formerly owned by another shop, and invalid ones", async () => {
    const a = await owner("taken-a");
    const b = await owner("taken-b");
    expect(await changeSlug(b, a.merchant.slug!)).toMatchObject({ ok: false, error: "slug_taken" });
    const old = a.merchant.slug!;
    await changeSlug(a, `moved-${randomUUID().slice(0, 6)}`);
    expect(await changeSlug(b, old)).toMatchObject({ ok: false, error: "slug_taken" });
    expect(await changeSlug(b, "Bad Slug")).toMatchObject({
      ok: false,
      error: "slug_invalid_chars",
    });
    expect(await changeSlug(b, "admin")).toMatchObject({ ok: false, error: "slug_reserved" });
  });
});

describe("profile and branding", () => {
  it("validates and saves through RLS", async () => {
    const ctx = await owner("profile");
    expect(
      await updateShopProfile(ctx, {
        name: "  Snack   Étoile ",
        phone: "+213 555 12 34 56",
        address: "",
        defaultLocale: "fr",
        locales: ["fr", "ar"],
      }),
    ).toEqual({ ok: true });
    const [m] = await serviceDb.select().from(merchants).where(eq(merchants.id, ctx.merchant.id));
    expect(m).toMatchObject({ name: "Snack Étoile", defaultLocale: "fr", address: null });
    expect(
      await updateShopProfile(ctx, { name: "x", defaultLocale: "en", locales: ["fr"] }),
    ).toMatchObject({ ok: false, error: "defaultLocale" });
  });

  it("refuses image paths from another merchant", async () => {
    const ctx = await owner("brand");
    const branding = {
      primaryColor: "#0b3d91",
      secondaryColor: "#e8a33d",
      font: "cairo",
      layout: "grid",
      welcome: {},
    };
    expect(
      await updateBranding(ctx, branding, { logoPath: `${randomUUID()}/logo/x.webp` }),
    ).toMatchObject({ ok: false, error: "forbidden" });
    expect(
      await updateBranding(ctx, branding, { logoPath: `${ctx.merchant.id}/logo/x.webp` }),
    ).toEqual({ ok: true });
  });

  it("is read-only for suspended accounts and owner-only for the open switch", async () => {
    const suspended = await owner("locked", { status: "suspended" });
    expect(
      await updateShopProfile(suspended, { name: "Nope", defaultLocale: "ar", locales: ["ar"] }),
    ).toMatchObject({ ok: false, error: "locked" });
    const staff = await owner("staffer", { role: "staff" });
    expect(await setShopToggles(staff, { isOpen: false })).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    expect(await setShopToggles(staff, { acceptingOrders: false })).toEqual({ ok: true });
  });
});

describe("menu", () => {
  it("enforces the plan's dish limit and stores prices in minor units", async () => {
    const ctx = await owner("menu");
    const cat = await createCategory(ctx, { name: "Drinks", nameI18n: {} });
    expect(cat.ok).toBe(true);
    const categoryId = cat.ok ? cat.data!.id : "";
    const dish = (name: string) =>
      saveItem(ctx, {
        categoryId,
        name,
        nameI18n: {},
        descriptionI18n: {},
        price: 120,
        optionGroups: [],
      });
    expect((await dish("Tea")).ok).toBe(true);
    expect((await dish("Coffee")).ok).toBe(true);
    expect(await dish("Juice")).toMatchObject({ ok: false, error: "plan_limit" });
    const rows = await serviceDb.select().from(items).where(eq(items.categoryId, categoryId));
    expect(rows.map((r) => r.priceMinor)).toEqual([12000, 12000]);
  });

  it("cannot write into another merchant's category", async () => {
    const a = await owner("menu-a");
    const b = await owner("menu-b");
    const cat = await createCategory(a, { name: "Mine", nameI18n: {} });
    const categoryId = cat.ok ? cat.data!.id : "";
    const intrusion = await saveItem(b, {
      categoryId,
      name: "Hack",
      nameI18n: {},
      descriptionI18n: {},
      price: 1,
      optionGroups: [],
    });
    expect(intrusion).toMatchObject({ ok: false, error: "not_found" });
    expect(await updateCategory(b, categoryId, { name: "Renamed", nameI18n: {} })).toMatchObject({
      ok: false,
      error: "not_found",
    });
  });

  it("publishes only visible sections that have dishes", async () => {
    const ctx = await owner("public");
    const shown = await createCategory(ctx, { name: "Shown", nameI18n: {} });
    const hidden = await createCategory(ctx, { name: "Hidden", nameI18n: {}, isVisible: false });
    await createCategory(ctx, { name: "Empty", nameI18n: {} });
    for (const c of [shown, hidden]) {
      if (c.ok)
        await saveItem(ctx, {
          categoryId: c.data!.id,
          name: "Dish",
          nameI18n: {},
          descriptionI18n: {},
          price: 100,
          optionGroups: [],
        });
    }
    const shop = await loadPublicShopUncached(ctx.merchant.id);
    expect(shop?.menu.map((c) => c.name)).toEqual(["Shown"]);
    const [cat] = await serviceDb.select().from(categories).where(eq(categories.name, "Hidden"));
    expect(cat?.isVisible).toBe(false);
  });
});
