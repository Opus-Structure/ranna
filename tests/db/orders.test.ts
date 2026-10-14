/** Ordering against the real database: placement rules, numbering, idempotency, lifecycle. */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb } from "@/lib/db/client";
import {
  categories,
  items,
  merchantMembers,
  merchants,
  optionGroups,
  options,
  orderItems,
  orders,
  plans,
  qrCodes,
} from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { loadCustomerOrder, placeOrder, setOrderStatus } from "@/lib/orders/service";
import { hashToken, orderTopic } from "@/lib/orders/token";
import type { RealtimePublisher } from "@/lib/realtime/publish";
import { createAuthUser, deleteAuthUsers } from "./fixtures";

const users: string[] = [];
const merchantIds: string[] = [];
let planId: string;

type Shop = {
  slug: string;
  merchantId: string;
  ownerId: string;
  teaId: string;
  wrapId: string;
  sizeIds: string[];
  soldOutId: string;
};

async function shop(
  label: string,
  extra: Partial<typeof merchants.$inferInsert> = {},
): Promise<Shop> {
  const ownerId = await createAuthUser(label);
  users.push(ownerId);
  const slug = `${label}-${randomUUID().slice(0, 6)}`;
  const [m] = await serviceDb
    .insert(merchants)
    .values({ name: `${label} snack`, slug, status: "active", planId, ...extra })
    .returning({ id: merchants.id });
  const merchantId = m!.id;
  merchantIds.push(merchantId);
  await serviceDb.insert(merchantMembers).values({ merchantId, userId: ownerId, role: "owner" });
  const [cat] = await serviceDb
    .insert(categories)
    .values({ merchantId, name: "Menu" })
    .returning({ id: categories.id });
  const [tea, wrap, soldOut] = await serviceDb
    .insert(items)
    .values([
      { merchantId, categoryId: cat!.id, name: "Tea", priceMinor: 10000 },
      { merchantId, categoryId: cat!.id, name: "Wrap", priceMinor: 45000 },
      { merchantId, categoryId: cat!.id, name: "Zlabia", priceMinor: 5000, isAvailable: false },
    ])
    .returning({ id: items.id });
  const [group] = await serviceDb
    .insert(optionGroups)
    .values({ merchantId, itemId: wrap!.id, name: "Size", minSelect: 1, maxSelect: 1 })
    .returning({ id: optionGroups.id });
  const sizes = await serviceDb
    .insert(options)
    .values([
      { merchantId, groupId: group!.id, name: "Regular", priceDeltaMinor: 0 },
      { merchantId, groupId: group!.id, name: "Maxi", priceDeltaMinor: 15000 },
    ])
    .returning({ id: options.id });
  return {
    slug,
    merchantId,
    ownerId,
    teaId: tea!.id,
    wrapId: wrap!.id,
    sizeIds: sizes.map((s) => s.id),
    soldOutId: soldOut!.id,
  };
}

const order = (s: Shop, over: Record<string, unknown> = {}) => ({
  slug: s.slug,
  clientRequestId: randomUUID(),
  customerName: "Amine",
  phone: "0555 12 34 56",
  locale: "fr",
  lines: [
    { itemId: s.teaId, quantity: 2, optionIds: [] },
    { itemId: s.wrapId, quantity: 1, optionIds: [s.sizeIds[1]] },
  ],
  ...over,
});

function staffCtx(s: Shop, userId = s.ownerId): MerchantContext {
  return {
    user: { id: userId, email: null, pendingShopName: null, locale: null },
    role: "staff",
    merchant: {
      id: s.merchantId,
      name: "x",
      slug: s.slug,
      status: "active",
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
}

beforeAll(async () => {
  const [p] = await serviceDb
    .insert(plans)
    .values({
      code: `orders-test-${randomUUID().slice(0, 8)}`,
      name: "Orders test",
      priceMinor: 100,
      limits: { maxItems: 50, maxStaff: 2, maxMonthlyOrders: 5 },
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

describe("placeOrder", () => {
  it("prices on the server, numbers from 101 and snapshots lines", async () => {
    const s = await shop("place");
    const first = await placeOrder(order(s));
    expect(first).toMatchObject({ ok: true, number: 101, duplicate: false });
    const second = await placeOrder(order(s));
    expect(second).toMatchObject({ ok: true, number: 102 });
    if (!first.ok) return;
    const [row] = await serviceDb
      .select()
      .from(orders)
      .where(eq(orders.tokenHash, hashToken(first.token)));
    expect(row).toMatchObject({
      totalMinor: 80000,
      currency: "DZD",
      customerName: "Amine",
      customerPhone: "0555123456",
      status: "new",
    });
    const lines = await serviceDb.select().from(orderItems).where(eq(orderItems.orderId, row!.id));
    expect(lines.map((l) => [l.name, l.unitPriceMinor, l.quantity])).toEqual(
      expect.arrayContaining([
        ["Tea", 10000, 2],
        ["Wrap", 60000, 1],
      ]),
    );
  });

  it("is idempotent for a retried request", async () => {
    const s = await shop("retry");
    const input = order(s);
    const a = await placeOrder(input);
    const b = await placeOrder(input);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b).toMatchObject({ duplicate: true, number: a.number, token: a.token });
    expect(
      await serviceDb.select().from(orders).where(eq(orders.merchantId, s.merchantId)),
    ).toHaveLength(1);
  });

  it("restarts numbering each business day in the shop's time zone", async () => {
    const s = await shop("daily");
    const night = new Date("2026-03-01T22:30:00Z"); // 23:30 in Algiers
    const nextMorning = new Date("2026-03-01T23:30:00Z"); // 00:30 next day in Algiers
    expect(await placeOrder(order(s), night)).toMatchObject({ number: 101 });
    expect(await placeOrder(order(s), night)).toMatchObject({ number: 102 });
    expect(await placeOrder(order(s), nextMorning)).toMatchObject({ number: 101 });
  });

  it("refuses when the shop cannot take orders", async () => {
    expect(await placeOrder(order(await shop("closed", { isOpen: false })))).toMatchObject({
      ok: false,
      error: "closed",
    });
    expect(await placeOrder(order(await shop("paused", { acceptingOrders: false })))).toMatchObject(
      { ok: false, error: "paused" },
    );
    expect(await placeOrder(order(await shop("suspended", { status: "suspended" })))).toMatchObject(
      { ok: false, error: "closed" },
    );
    expect(
      await placeOrder({ ...order(await shop("ghost")), slug: "no-such-shop-x" }),
    ).toMatchObject({ ok: false, error: "not_found" });
  });

  it("refuses bots, bad input and unavailable dishes", async () => {
    const s = await shop("guard");
    expect(await placeOrder(order(s, { website: "http://spam" }))).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(await placeOrder(order(s, { customerName: "   " }))).toMatchObject({
      ok: false,
      error: "nameRequired",
    });
    expect(await placeOrder(order(s, { phone: "call me" }))).toMatchObject({
      ok: false,
      error: "phone",
    });
    expect(
      await placeOrder(order(s, { lines: [{ itemId: s.soldOutId, quantity: 1, optionIds: [] }] })),
    ).toMatchObject({
      ok: false,
      error: "item_unavailable",
      itemId: s.soldOutId,
    });
    expect(
      await placeOrder(order(s, { lines: [{ itemId: s.wrapId, quantity: 1, optionIds: [] }] })),
    ).toMatchObject({
      ok: false,
      error: "option_required",
    });
  });

  it("enforces the plan's monthly order limit", async () => {
    const s = await shop("limit");
    for (let i = 0; i < 5; i++) expect((await placeOrder(order(s))).ok).toBe(true);
    expect(await placeOrder(order(s))).toMatchObject({ ok: false, error: "shop_busy" });
  });

  it("records the table label from the shop's QR codes", async () => {
    const s = await shop("table");
    await serviceDb
      .insert(qrCodes)
      .values({ merchantId: s.merchantId, label: "Terrasse 4", tableCode: "T4" });
    const r = await placeOrder(order(s, { table: "T4" }));
    if (!r.ok) throw new Error(r.error);
    const view = await loadCustomerOrder(r.token);
    expect(view?.tableLabel).toBe("Terrasse 4");
    expect(await loadCustomerOrder("A".repeat(22))).toBeNull();
    expect(await loadCustomerOrder("not-a-token")).toBeNull();
  });

  it("shows lines in ticket order with the translations they had when ordered", async () => {
    const s = await shop("i18n");
    await serviceDb
      .update(items)
      .set({ nameI18n: { fr: "Wrap poulet" } })
      .where(eq(items.id, s.wrapId));
    await serviceDb
      .update(options)
      .set({ nameI18n: { fr: "Grand" } })
      .where(eq(options.id, s.sizeIds[1]!));
    // Wrap first, then tea: the reverse of the default fixture, and of nothing alphabetical.
    const lines = [
      { itemId: s.wrapId, quantity: 1, optionIds: [s.sizeIds[1]] },
      { itemId: s.teaId, quantity: 3, optionIds: [] },
    ];
    const r = await placeOrder(order(s, { lines }));
    if (!r.ok) throw new Error(r.error);
    // A later rename never rewrites a placed order.
    await serviceDb
      .update(items)
      .set({ name: "Renamed", nameI18n: { fr: "Renommé" } })
      .where(eq(items.id, s.wrapId));
    const view = await loadCustomerOrder(r.token);
    expect(view?.items.map((i) => [i.name, i.nameI18n.fr ?? null, i.quantity])).toEqual([
      ["Wrap", "Wrap poulet", 1],
      ["Tea", null, 3],
    ]);
    expect(view?.items[0]?.options).toEqual([{ name: "Maxi", nameI18n: { fr: "Grand" } }]);
  });
});

describe("setOrderStatus", () => {
  it("walks the lifecycle, stamps times and tells the customer's topic", async () => {
    const s = await shop("life");
    const placed = await placeOrder(order(s));
    if (!placed.ok) throw new Error(placed.error);
    const [row] = await serviceDb
      .select()
      .from(orders)
      .where(eq(orders.tokenHash, hashToken(placed.token)));
    const sent: { topic: string; payload: Record<string, unknown> }[] = [];
    const publisher: RealtimePublisher = {
      publish: async (topic, _e, payload) => void sent.push({ topic, payload }),
    };
    const ctx = staffCtx(s);

    expect(await setOrderStatus(ctx, row!.id, "preparing", {}, publisher)).toEqual({
      ok: true,
      status: "preparing",
    });
    expect(await setOrderStatus(ctx, row!.id, "accepted", {}, publisher)).toMatchObject({
      ok: false,
      error: "invalid_transition",
    });
    expect(await setOrderStatus(ctx, row!.id, "ready", {}, publisher)).toMatchObject({ ok: true });
    const [ready] = await serviceDb.select().from(orders).where(eq(orders.id, row!.id));
    expect(ready?.readyAt).toBeInstanceOf(Date);
    expect(ready?.preparingAt).toBeInstanceOf(Date);
    expect(sent.at(-1)).toEqual({
      topic: orderTopic(hashToken(placed.token)),
      payload: expect.objectContaining({ status: "ready", stage: "ready", number: 101 }),
    });
    expect(await setOrderStatus(ctx, row!.id, "canceled", {}, publisher)).toMatchObject({
      ok: false,
      error: "reason_required",
    });
    expect(await setOrderStatus(ctx, row!.id, "completed", {}, publisher)).toMatchObject({
      ok: true,
    });
  });

  it("cannot touch another shop's orders", async () => {
    const a = await shop("iso-a");
    const b = await shop("iso-b");
    const placed = await placeOrder(order(a));
    if (!placed.ok) throw new Error(placed.error);
    const [row] = await serviceDb
      .select()
      .from(orders)
      .where(eq(orders.tokenHash, hashToken(placed.token)));
    const noop: RealtimePublisher = { publish: async () => undefined };
    expect(await setOrderStatus(staffCtx(b), row!.id, "ready", {}, noop)).toMatchObject({
      ok: false,
      error: "not_found",
    });
  });
});
