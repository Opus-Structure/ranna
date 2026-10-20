import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { withRls, type Tx } from "@/lib/db/client";
import { merchants, orderItems, orders } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { businessDate } from "@/lib/time";
import { kitchenConfig, type KitchenConfig } from "./kitchen";
import { ORDER_STATUSES, type OrderStatus } from "./transitions";

/** What staff see of one order. Names are the shop's own (snapshot at ordering time). */
export type BoardOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  tableLabel: string | null;
  note: string | null;
  totalMinor: number;
  placedAt: string;
  /** When the order entered its current status: what the wait band measures on the board. */
  statusAt: string;
  readyAt: string | null;
  acknowledgedAt: string | null;
  cancelReason: string | null;
  items: { name: string; quantity: number; options: string[]; note: string | null }[];
};

export type Board = {
  open: BoardOrder[];
  /** Today's finished orders, most recent first. */
  done: BoardOrder[];
  prepTargetMinutes: number;
  /** Where new orders are routed for the kitchen (the owner's setting). */
  kitchen: KitchenConfig;
  generatedAt: string;
};

const OPEN: OrderStatus[] = ["new", "accepted", "preparing", "ready"];
const DONE_SHOWN = 24;

const orderColumns = {
  id: orders.id,
  number: orders.number,
  status: orders.status,
  customerName: orders.customerName,
  tableLabel: orders.tableLabel,
  note: orders.note,
  totalMinor: orders.totalMinor,
  placedAt: orders.placedAt,
  acceptedAt: orders.acceptedAt,
  preparingAt: orders.preparingAt,
  readyAt: orders.readyAt,
  completedAt: orders.completedAt,
  canceledAt: orders.canceledAt,
  acknowledgedAt: orders.acknowledgedAt,
  cancelReason: orders.cancelReason,
};
type OrderRow = { [K in keyof typeof orderColumns]: (typeof orders.$inferSelect)[K] };

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function statusTime(o: OrderRow): Date {
  switch (o.status) {
    case "accepted":
      return o.acceptedAt ?? o.placedAt;
    case "preparing":
      return o.preparingAt ?? o.acceptedAt ?? o.placedAt;
    case "ready":
      return o.readyAt ?? o.placedAt;
    case "completed":
      return o.completedAt ?? o.placedAt;
    case "canceled":
      return o.canceledAt ?? o.placedAt;
    default:
      return o.placedAt;
  }
}

async function withItems(tx: Tx, rows: OrderRow[]): Promise<BoardOrder[]> {
  if (rows.length === 0) return [];
  const lines = await tx
    .select({
      orderId: orderItems.orderId,
      name: orderItems.name,
      quantity: orderItems.quantity,
      options: orderItems.options,
      note: orderItems.note,
    })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(orderItems.position));
  const byOrder = new Map<string, BoardOrder["items"]>();
  for (const l of lines) {
    const list = byOrder.get(l.orderId) ?? [];
    list.push({
      name: l.name,
      quantity: l.quantity,
      options: l.options.map((o) => o.optionName),
      note: l.note,
    });
    byOrder.set(l.orderId, list);
  }
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    customerName: o.customerName,
    tableLabel: o.tableLabel,
    note: o.note,
    totalMinor: o.totalMinor,
    placedAt: o.placedAt.toISOString(),
    statusAt: statusTime(o).toISOString(),
    readyAt: iso(o.readyAt),
    acknowledgedAt: iso(o.acknowledgedAt),
    cancelReason: o.cancelReason,
    items: byOrder.get(o.id) ?? [],
  }));
}

/**
 * The live board: every open order (whatever day it was placed: a forgotten ticket must stay
 * visible) plus today's finished ones. RLS scopes it to the member's shop.
 */
export async function loadBoard(ctx: MerchantContext, now = new Date()): Promise<Board> {
  const today = businessDate(now, ctx.merchant.timezone);
  return withRls(ctx.user.id, async (tx) => {
    const open = await tx
      .select(orderColumns)
      .from(orders)
      .where(and(eq(orders.merchantId, ctx.merchant.id), inArray(orders.status, OPEN)))
      .orderBy(asc(orders.placedAt));
    const done = await tx
      .select(orderColumns)
      .from(orders)
      .where(
        and(
          eq(orders.merchantId, ctx.merchant.id),
          eq(orders.businessDate, today),
          inArray(orders.status, ["completed", "canceled"]),
        ),
      )
      .orderBy(desc(orders.updatedAt))
      .limit(DONE_SHOWN);
    const [m] = await tx
      .select({ settings: merchants.settings })
      .from(merchants)
      .where(eq(merchants.id, ctx.merchant.id));
    return {
      open: await withItems(tx, open),
      done: await withItems(tx, done),
      prepTargetMinutes: m?.settings.prepTargetMinutes ?? 10,
      kitchen: kitchenConfig(m?.settings ?? {}),
      generatedAt: now.toISOString(),
    };
  });
}

/** The shop's kitchen routing alone: the console nav only needs this. */
export async function loadKitchenConfig(ctx: MerchantContext): Promise<KitchenConfig> {
  const [m] = await withRls(ctx.user.id, (tx) =>
    tx
      .select({ settings: merchants.settings })
      .from(merchants)
      .where(eq(merchants.id, ctx.merchant.id)),
  );
  return kitchenConfig(m?.settings ?? {});
}

/** New orders waiting for a first look: the count on the "Orders" nav item. */
export async function countNewOrders(ctx: MerchantContext): Promise<number> {
  const [row] = await withRls(ctx.user.id, (tx) =>
    tx
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.merchantId, ctx.merchant.id), eq(orders.status, "new"))),
  );
  return Number(row?.n ?? 0);
}

export const historyQuerySchema = z.object({
  // A real calendar day or nothing (today): a bad value falls back instead of failing the page.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
    })
    .optional()
    .catch(undefined),
  status: z.enum(["all", ...ORDER_STATUSES]).catch("all"),
  q: z
    .string()
    .max(40)
    .transform((v) => v.trim())
    .catch(""),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export type HistoryTotals = {
  orders: number;
  completed: number;
  canceled: number;
  /** Sum of completed orders: money the counter should have taken. */
  collectedMinor: number;
  averageMinor: number;
};

export type History = {
  date: string;
  orders: BoardOrder[];
  totals: HistoryTotals;
};

export const HISTORY_LIMIT = 500;

/** One business day of orders, filtered, with the day's totals (totals ignore the filters). */
export async function loadHistory(
  ctx: MerchantContext,
  raw: unknown,
  now = new Date(),
): Promise<History> {
  const query = historyQuerySchema.parse(raw ?? {});
  const date = query.date ?? businessDate(now, ctx.merchant.timezone);
  return withRls(ctx.user.id, async (tx) => {
    const day = and(eq(orders.merchantId, ctx.merchant.id), eq(orders.businessDate, date));
    const filters: (SQL | undefined)[] = [day];
    if (query.status !== "all") filters.push(eq(orders.status, query.status));
    if (query.q) {
      const n = Number(query.q);
      filters.push(
        Number.isInteger(n) && n > 0
          ? eq(orders.number, n)
          : or(
              ilike(orders.customerName, `%${escapeLike(query.q)}%`),
              ilike(orders.tableLabel, `%${escapeLike(query.q)}%`),
            ),
      );
    }
    const rows = await tx
      .select(orderColumns)
      .from(orders)
      .where(and(...filters))
      .orderBy(desc(orders.number))
      .limit(HISTORY_LIMIT);
    const [t] = await tx
      .select({
        orders: count(),
        completed: sql<string>`count(*) filter (where ${orders.status} = 'completed')`,
        canceled: sql<string>`count(*) filter (where ${orders.status} = 'canceled')`,
        collected: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} = 'completed'), 0)`,
      })
      .from(orders)
      .where(day);
    const completed = Number(t?.completed ?? 0);
    const collectedMinor = Number(t?.collected ?? 0);
    return {
      date,
      orders: await withItems(tx, rows),
      totals: {
        orders: Number(t?.orders ?? 0),
        completed,
        canceled: Number(t?.canceled ?? 0),
        collectedMinor,
        averageMinor: completed ? Math.round(collectedMinor / completed) : 0,
      },
    };
  });
}

function escapeLike(v: string) {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}
