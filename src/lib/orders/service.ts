import "server-only";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { serviceDb, withRls } from "@/lib/db/client";
import { merchants, orderCounters, orderItems, orders, plans, qrCodes } from "@/lib/db/schema";
import type { I18nText, MerchantBranding } from "@/lib/db/schema/types";
import { serverEnv } from "@/lib/env";
import type { MerchantContext } from "@/lib/merchants/context";
import { supabaseBroadcast, type RealtimePublisher } from "@/lib/realtime/publish";
import { loadPublicShopUncached } from "@/lib/shop/public";
import { storefrontStatus } from "@/lib/shop/status";
import { businessDate } from "@/lib/time";
import { placeOrderSchema } from "@/lib/validation/order";
import { priceOrder, type PricingError } from "./pricing";
import { hashToken, orderTokenFor, orderTopic, TOKEN_PATTERN } from "./token";
import { canTransition, customerStage, timestampFor, type OrderStatus } from "./transitions";

export type PlaceOrderError =
  | PricingError
  | "invalid"
  | "closed"
  | "paused"
  | "shop_busy"
  | "not_found"
  | "nameRequired"
  | "nameTooLong"
  | "phone"
  | "noteTooLong";

export type PlaceOrderResult =
  | { ok: true; token: string; number: number; duplicate: boolean }
  | { ok: false; error: PlaceOrderError; itemId?: string };

/** First order of the day is 101: short, human, and never confused with a quantity. */
export const FIRST_ORDER_NUMBER = 101;

function startOfMonth(at: Date, timeZone: string): Date {
  const [y, m] = businessDate(at, timeZone).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1) - 14 * 3600_000); // generous: covers any UTC offset
}

/**
 * Places an order for an anonymous customer. Everything the customer sends is re-validated;
 * prices come from the database; the shop must be able to take orders right now. Retrying with
 * the same `clientRequestId` returns the same order (idempotent).
 */
export async function placeOrder(raw: unknown, now = new Date()): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(raw);
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message;
    const known = [
      "nameRequired",
      "nameTooLong",
      "phone",
      "noteTooLong",
      "empty",
      "too_many_lines",
    ];
    return { ok: false, error: (known.includes(key ?? "") ? key : "invalid") as PlaceOrderError };
  }
  const input = parsed.data;
  if (input.website) return { ok: false, error: "invalid" };

  const [m] = await serviceDb
    .select({ id: merchants.id, planId: merchants.planId })
    .from(merchants)
    .where(eq(merchants.slug, input.slug.toLowerCase()));
  if (!m) return { ok: false, error: "not_found" };

  const shop = await loadPublicShopUncached(m.id);
  if (!shop) return { ok: false, error: "not_found" };
  const status = storefrontStatus(shop, now);
  if (!status.canOrder) return { ok: false, error: status.tone === "paused" ? "paused" : "closed" };

  const priced = priceOrder(shop.menu, input.lines);
  if (!priced.ok) return { ok: false, error: priced.error, itemId: priced.itemId };

  const token = orderTokenFor(serverEnv().APP_SECRET, m.id, input.clientRequestId);
  const tokenHash = hashToken(token);

  return serviceDb.transaction(async (tx) => {
    // Same request retried (double tap, flaky network): hand back the order already placed.
    const [existing] = await tx
      .select({ number: orders.number })
      .from(orders)
      .where(and(eq(orders.merchantId, m.id), eq(orders.clientRequestId, input.clientRequestId)));
    if (existing) return { ok: true, token, number: existing.number, duplicate: true } as const;

    if (m.planId) {
      const [plan] = await tx
        .select({ limits: plans.limits })
        .from(plans)
        .where(eq(plans.id, m.planId));
      const monthly = plan?.limits.maxMonthlyOrders;
      if (monthly) {
        const [used] = await tx
          .select({ n: count() })
          .from(orders)
          .where(
            and(
              eq(orders.merchantId, m.id),
              gte(orders.placedAt, startOfMonth(now, shop.timezone)),
            ),
          );
        if (Number(used?.n ?? 0) >= monthly) return { ok: false, error: "shop_busy" } as const;
      }
    }

    let tableLabel: string | null = null;
    if (input.table) {
      const [qr] = await tx
        .select({ label: qrCodes.label })
        .from(qrCodes)
        .where(and(eq(qrCodes.merchantId, m.id), eq(qrCodes.tableCode, input.table)));
      tableLabel = qr?.label ?? input.table;
    }

    const day = businessDate(now, shop.timezone);
    const [counter] = await tx
      .insert(orderCounters)
      .values({ merchantId: m.id, businessDate: day, lastNumber: FIRST_ORDER_NUMBER })
      .onConflictDoUpdate({
        target: [orderCounters.merchantId, orderCounters.businessDate],
        set: { lastNumber: sql`${orderCounters.lastNumber} + 1` },
      })
      .returning({ n: orderCounters.lastNumber });

    const [order] = await tx
      .insert(orders)
      .values({
        merchantId: m.id,
        number: counter!.n,
        businessDate: day,
        tokenHash,
        clientRequestId: input.clientRequestId,
        customerName: input.customerName,
        customerPhone: shop.askPhone ? input.phone : null,
        tableLabel,
        note: input.note,
        locale: input.locale,
        subtotalMinor: priced.subtotalMinor,
        totalMinor: priced.totalMinor,
        currency: shop.currency,
        placedAt: now,
      })
      .returning({ id: orders.id, number: orders.number });

    await tx.insert(orderItems).values(
      priced.lines.map((l, position) => ({
        orderId: order!.id,
        merchantId: m.id,
        itemId: l.itemId,
        name: l.name,
        nameI18n: l.nameI18n,
        position,
        unitPriceMinor: l.unitPriceMinor,
        quantity: l.quantity,
        options: l.options,
        lineTotalMinor: l.lineTotalMinor,
        note: l.note,
      })),
    );
    return { ok: true, token, number: order!.number, duplicate: false } as const;
  });
}

export type CustomerOrderView = {
  number: number;
  status: OrderStatus;
  stage: ReturnType<typeof customerStage>;
  customerName: string;
  tableLabel: string | null;
  note: string | null;
  locale: string;
  totalMinor: number;
  currency: string;
  placedAt: string;
  readyAt: string | null;
  acknowledgedAt: string | null;
  cancelReason: string | null;
  topic: string;
  items: {
    name: string;
    nameI18n: I18nText;
    quantity: number;
    lineTotalMinor: number;
    options: { name: string; nameI18n: I18nText }[];
    note: string | null;
  }[];
  shop: {
    name: string;
    slug: string | null;
    branding: MerchantBranding;
    timezone: string;
  };
};

/** Everything the customer's status page shows, looked up by token (the only credential). */
export async function loadCustomerOrder(token: string): Promise<CustomerOrderView | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const tokenHash = hashToken(token);
  const [row] = await serviceDb
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      customerName: orders.customerName,
      tableLabel: orders.tableLabel,
      note: orders.note,
      locale: orders.locale,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      placedAt: orders.placedAt,
      readyAt: orders.readyAt,
      acknowledgedAt: orders.acknowledgedAt,
      cancelReason: orders.cancelReason,
      shopName: merchants.name,
      shopSlug: merchants.slug,
      shopTimezone: merchants.timezone,
      branding: merchants.branding,
    })
    .from(orders)
    .innerJoin(merchants, eq(merchants.id, orders.merchantId))
    .where(eq(orders.tokenHash, tokenHash));
  if (!row) return null;
  const lines = await serviceDb
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, row.id))
    .orderBy(asc(orderItems.position));
  return {
    number: row.number,
    status: row.status,
    stage: customerStage(row.status),
    customerName: row.customerName,
    tableLabel: row.tableLabel,
    note: row.note,
    locale: row.locale,
    totalMinor: row.totalMinor,
    currency: row.currency,
    placedAt: row.placedAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    topic: orderTopic(tokenHash),
    items: lines.map((l) => ({
      name: l.name,
      nameI18n: l.nameI18n,
      quantity: l.quantity,
      lineTotalMinor: l.lineTotalMinor,
      options: l.options.map((o) => ({ name: o.optionName, nameI18n: o.optionNameI18n ?? {} })),
      note: l.note,
    })),
    shop: {
      name: row.shopName,
      slug: row.shopSlug,
      branding: row.branding,
      timezone: row.shopTimezone,
    },
  };
}

/** The small, frequently polled part of the status page. */
export type CustomerOrderStatus = Pick<
  CustomerOrderView,
  "number" | "status" | "stage" | "readyAt" | "acknowledgedAt" | "cancelReason"
>;

export function statusPayload(o: {
  number: number;
  status: OrderStatus;
  readyAt: Date | string | null;
  acknowledgedAt: Date | string | null;
  cancelReason: string | null;
}): CustomerOrderStatus {
  const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
  return {
    number: o.number,
    status: o.status,
    stage: customerStage(o.status),
    readyAt: iso(o.readyAt),
    acknowledgedAt: iso(o.acknowledgedAt),
    cancelReason: o.cancelReason,
  };
}

export async function loadCustomerOrderStatus(token: string): Promise<CustomerOrderStatus | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [row] = await serviceDb
    .select({
      number: orders.number,
      status: orders.status,
      readyAt: orders.readyAt,
      acknowledgedAt: orders.acknowledgedAt,
      cancelReason: orders.cancelReason,
    })
    .from(orders)
    .where(eq(orders.tokenHash, hashToken(token)));
  return row ? statusPayload(row) : null;
}

export type StatusChangeResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; error: "forbidden" | "not_found" | "invalid_transition" | "reason_required" };

/**
 * Moves an order through its lifecycle as a staff member (RLS-scoped to their shop), stamps the
 * step's time and tells the customer's page. Phase 7 adds the ring on "ready".
 */
export async function setOrderStatus(
  ctx: MerchantContext,
  orderId: string,
  to: OrderStatus,
  opts: { cancelReason?: string } = {},
  publisher: RealtimePublisher = supabaseBroadcast,
): Promise<StatusChangeResult> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, error: "not_found" };
  const reason = opts.cancelReason?.trim().slice(0, 200) ?? "";
  if (to === "canceled" && !reason) return { ok: false, error: "reason_required" };

  const result = await withRls(ctx.user.id, async (tx) => {
    const [order] = await tx
      .select({ status: orders.status, tokenHash: orders.tokenHash })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) return { ok: false, error: "not_found" } as const;
    if (!canTransition(order.status, to))
      return { ok: false, error: "invalid_transition" } as const;
    const stamp = timestampFor(to);
    const now = new Date();
    const [updated] = await tx
      .update(orders)
      .set({
        status: to,
        ...(stamp ? { [stamp]: now } : {}),
        ...(to === "ready" && order.status !== "ready" ? { readyAt: now } : {}),
        ...(to === "canceled" ? { cancelReason: reason } : {}),
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning({
        number: orders.number,
        status: orders.status,
        readyAt: orders.readyAt,
        acknowledgedAt: orders.acknowledgedAt,
        cancelReason: orders.cancelReason,
      });
    return { ok: true, tokenHash: order.tokenHash, updated: updated! } as const;
  });
  if (!result.ok) return result;
  await publisher.publish(orderTopic(result.tokenHash), "status", statusPayload(result.updated));
  return { ok: true, status: to };
}
