import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { withRls } from "@/lib/db/client";
import { invoices, payments, plans, subscriptions } from "@/lib/db/schema";

export type BillingView = Awaited<ReturnType<typeof getBillingView>>;

/** Everything the billing page shows, read as the owner through RLS. */
export async function getBillingView(userId: string, merchantId: string) {
  return withRls(userId, async (tx) => {
    const planRows = await tx
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.sort));
    const [subscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.merchantId, merchantId));
    const invoiceRows = await tx
      .select({
        id: invoices.id,
        number: invoices.number,
        planId: invoices.planId,
        amountMinor: invoices.amountMinor,
        currency: invoices.currency,
        status: invoices.status,
        provider: invoices.provider,
        periodStart: invoices.periodStart,
        periodEnd: invoices.periodEnd,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(eq(invoices.merchantId, merchantId))
      .orderBy(desc(invoices.createdAt))
      .limit(50);
    const recentPayments = await tx
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        provider: payments.provider,
        status: payments.status,
        reviewNote: payments.reviewNote,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.merchantId, merchantId))
      .orderBy(desc(payments.createdAt))
      .limit(20);
    return {
      plans: planRows,
      subscription: subscription ?? null,
      invoices: invoiceRows,
      pendingReview: recentPayments.find((p) => p.status === "pending_review") ?? null,
      lastRejected: recentPayments.find((p) => p.status === "rejected") ?? null,
    };
  });
}
