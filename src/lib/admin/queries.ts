import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { withRls } from "@/lib/db/client";
import { invoices, merchants, orders, payments, plans, subscriptions } from "@/lib/db/schema";

export const merchantStatuses = [
  "pending_payment",
  "active",
  "past_due",
  "suspended",
  "canceled",
] as const;
export type MerchantStatusFilter = (typeof merchantStatuses)[number];

/** Admin reads go through RLS too: the is_platform_admin policy grants the cross-tenant view. */
export async function listMerchants(
  adminId: string,
  filter: { q?: string; status?: MerchantStatusFilter },
) {
  const where: SQL[] = [];
  if (filter.status) where.push(eq(merchants.status, filter.status));
  const q = filter.q?.trim().slice(0, 80);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(merchants.name, like), ilike(merchants.slug, like))!);
  }
  return withRls(adminId, (tx) =>
    tx
      .select({
        id: merchants.id,
        name: merchants.name,
        slug: merchants.slug,
        status: merchants.status,
        periodEnd: merchants.periodEnd,
        createdAt: merchants.createdAt,
        plan: plans.name,
        isTrial: subscriptions.isTrial,
      })
      .from(merchants)
      .leftJoin(plans, eq(plans.id, merchants.planId))
      .leftJoin(subscriptions, eq(subscriptions.merchantId, merchants.id))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(merchants.createdAt))
      .limit(200),
  );
}

export async function listPayments(adminId: string) {
  return withRls(adminId, async (tx) => {
    const base = tx
      .select({
        id: payments.id,
        status: payments.status,
        provider: payments.provider,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        reference: payments.reference,
        receiptPath: payments.receiptPath,
        reviewNote: payments.reviewNote,
        createdAt: payments.createdAt,
        merchant: merchants.name,
        merchantId: merchants.id,
        invoice: invoices.number,
        plan: plans.name,
      })
      .from(payments)
      .innerJoin(merchants, eq(merchants.id, payments.merchantId))
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(plans, eq(plans.id, invoices.planId));
    const pending = await base
      .where(eq(payments.status, "pending_review"))
      .orderBy(payments.createdAt);
    const recent = await tx
      .select({
        id: payments.id,
        status: payments.status,
        provider: payments.provider,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        createdAt: payments.createdAt,
        merchant: merchants.name,
        invoice: invoices.number,
      })
      .from(payments)
      .innerJoin(merchants, eq(merchants.id, payments.merchantId))
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(inArray(payments.status, ["succeeded", "failed", "rejected", "pending"]))
      .orderBy(desc(payments.createdAt))
      .limit(50);
    return { pending, recent };
  });
}

export async function listPlans(adminId: string) {
  return withRls(adminId, (tx) => tx.select().from(plans).orderBy(plans.sort));
}

export async function platformMetrics(adminId: string, now = new Date()) {
  return withRls(adminId, async (tx) => {
    const byState = await tx
      .select({ status: merchants.status, n: count() })
      .from(merchants)
      .groupBy(merchants.status);
    const [mrr] = await tx
      .select({
        total: sql<string>`coalesce(sum(case when ${plans.interval} = 'year' then ${plans.priceMinor} / 12 else ${plans.priceMinor} end), 0)`,
        currency: sql<string>`coalesce(max(${plans.currency}), 'DZD')`,
      })
      .from(merchants)
      .innerJoin(plans, eq(plans.id, merchants.planId))
      .innerJoin(subscriptions, eq(subscriptions.merchantId, merchants.id))
      .where(
        and(inArray(merchants.status, ["active", "past_due"]), eq(subscriptions.isTrial, false)),
      );
    const [trials] = await tx
      .select({ n: count() })
      .from(subscriptions)
      .innerJoin(merchants, eq(merchants.id, subscriptions.merchantId))
      .where(and(eq(subscriptions.isTrial, true), eq(merchants.status, "active")));
    const [orders30] = await tx
      .select({ n: count() })
      .from(orders)
      .where(gte(orders.placedAt, new Date(now.getTime() - 30 * 86_400_000)));
    const [pending] = await tx
      .select({ n: count() })
      .from(payments)
      .where(eq(payments.status, "pending_review"));
    return {
      byState: Object.fromEntries(byState.map((r) => [r.status, Number(r.n)])) as Partial<
        Record<string, number>
      >,
      mrrMinor: Number(mrr?.total ?? 0),
      currency: mrr?.currency ?? "DZD",
      trials: Number(trials?.n ?? 0),
      orders30: Number(orders30?.n ?? 0),
      pendingReview: Number(pending?.n ?? 0),
    };
  });
}
