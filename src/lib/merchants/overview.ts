import "server-only";
import { and, count, eq, inArray, isNotNull, min, ne, sql } from "drizzle-orm";
import { withRls } from "@/lib/db/client";
import { items, merchants, orders, qrCodes } from "@/lib/db/schema";
import { businessDate } from "@/lib/time";
import type { ConsoleMerchant } from "./context";

export type Lane = { count: number; oldestAt: Date | null };

export type Overview = {
  lanes: { new: Lane; preparing: Lane; ready: Lane };
  today: { orders: number; collectedMinor: number };
  prepTargetMinutes: number;
  setup: { plan: boolean; shop: boolean; menu: boolean; qr: boolean };
};

/** Everything the overview needs, in one RLS-scoped transaction. */
export async function getOverview(
  userId: string,
  merchant: ConsoleMerchant,
  now = new Date(),
): Promise<Overview> {
  const today = businessDate(now, merchant.timezone);
  return withRls(userId, async (tx) => {
    const laneRows = await tx
      .select({ status: orders.status, n: count(), oldest: min(orders.placedAt) })
      .from(orders)
      .where(
        and(
          eq(orders.merchantId, merchant.id),
          inArray(orders.status, ["new", "accepted", "preparing", "ready"]),
        ),
      )
      .groupBy(orders.status);

    const lane = (statuses: string[]): Lane => {
      const rows = laneRows.filter((r) => statuses.includes(r.status));
      const oldest = rows
        .map((r) => (r.oldest ? new Date(r.oldest) : null))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      return { count: rows.reduce((s, r) => s + Number(r.n), 0), oldestAt: oldest ?? null };
    };

    const [todayRow] = await tx
      .select({
        n: count(),
        collected: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} = 'completed'), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.merchantId, merchant.id),
          eq(orders.businessDate, today),
          ne(orders.status, "canceled"),
        ),
      );

    const [settingsRow] = await tx
      .select({ settings: merchants.settings })
      .from(merchants)
      .where(eq(merchants.id, merchant.id));
    const [itemRow] = await tx
      .select({ n: count() })
      .from(items)
      .where(eq(items.merchantId, merchant.id));
    const [qrRow] = await tx
      .select({ n: count() })
      .from(qrCodes)
      .where(and(eq(qrCodes.merchantId, merchant.id), isNotNull(qrCodes.id)));

    return {
      lanes: {
        new: lane(["new", "accepted"]),
        preparing: lane(["preparing"]),
        ready: lane(["ready"]),
      },
      today: { orders: Number(todayRow?.n ?? 0), collectedMinor: Number(todayRow?.collected ?? 0) },
      prepTargetMinutes: settingsRow?.settings.prepTargetMinutes ?? 10,
      setup: {
        plan: merchant.status === "active" || merchant.status === "past_due",
        shop: Boolean(merchant.slug && merchant.setupCompletedAt),
        menu: Number(itemRow?.n ?? 0) > 0,
        qr: Number(qrRow?.n ?? 0) > 0,
      },
    };
  });
}
