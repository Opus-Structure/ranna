import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { billingConfig } from "@/config/billing";
import { writeAudit } from "@/lib/audit/log";
import { serviceDb, type Tx } from "@/lib/db/client";
import { invoices, merchants, payments, plans } from "@/lib/db/schema";
import { applyAccountEvent, type Actor, type AppliedEvent } from "./account-service";
import { formatInvoiceNumber } from "./invoice-number";
import { addDays, addInterval } from "./state-machine";

export type Provider = "mock" | "manual" | "chargily";
type Plan = typeof plans.$inferSelect;
type Invoice = typeof invoices.$inferSelect;
type Payment = typeof payments.$inferSelect;

export async function getPlan(db: Tx | typeof serviceDb, planId: string): Promise<Plan | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  return plan ?? null;
}

/**
 * An open invoice for this merchant and plan, reused while still payable so retries and
 * double clicks never mint duplicate invoices.
 */
export async function openInvoice(
  tx: Tx,
  merchantId: string,
  plan: Plan,
  now = new Date(),
): Promise<Invoice> {
  const [existing] = await tx
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.merchantId, merchantId),
        eq(invoices.planId, plan.id),
        eq(invoices.status, "open"),
        gt(invoices.dueAt, now),
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .limit(1);
  if (existing) return existing;

  const [m] = await tx
    .select({ periodEnd: merchants.periodEnd })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  const start = m?.periodEnd && m.periodEnd > now ? m.periodEnd : now;
  const [seq] = await tx.execute<{ n: string }>(sql`select nextval('invoice_number_seq') as n`);
  const [invoice] = await tx
    .insert(invoices)
    .values({
      merchantId,
      number: formatInvoiceNumber(billingConfig.invoicePrefix, now, Number(seq!.n)),
      planId: plan.id,
      periodStart: start,
      periodEnd: addInterval(start, { unit: plan.interval, count: plan.intervalCount }),
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      status: "open",
      dueAt: addDays(now, billingConfig.invoiceDueDays),
    })
    .returning();
  return invoice!;
}

export async function createPayment(
  tx: Tx,
  input: {
    invoice: Invoice;
    provider: Provider;
    status?: "pending" | "pending_review";
    reference?: string | null;
  },
): Promise<Payment> {
  const [payment] = await tx
    .insert(payments)
    .values({
      merchantId: input.invoice.merchantId,
      invoiceId: input.invoice.id,
      provider: input.provider,
      amountMinor: input.invoice.amountMinor,
      currency: input.invoice.currency,
      status: input.status ?? "pending",
      reference: input.reference ?? null,
    })
    .returning();
  return payment!;
}

export type SettleResult =
  { ok: true; alreadySettled: boolean; applied?: AppliedEvent } | { ok: false; error: "not_found" };

/**
 * Marks a payment as received and activates/extends the account, exactly once.
 * Called by verified webhooks and by admin approval of manual payments, never by the browser.
 */
export async function settlePayment(
  paymentId: string,
  actor: Actor,
  providerRef?: string,
): Promise<SettleResult> {
  return serviceDb.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .for("update");
    if (!payment) return { ok: false, error: "not_found" } as const;
    if (payment.status === "succeeded") return { ok: true, alreadySettled: true } as const;

    const now = new Date();
    await tx
      .update(payments)
      .set({
        status: "succeeded",
        providerRef: providerRef ?? payment.providerRef,
        reviewedBy: actor.type === "admin" ? (actor.userId ?? null) : payment.reviewedBy,
        reviewedAt: actor.type === "admin" ? now : payment.reviewedAt,
      })
      .where(eq(payments.id, paymentId));

    const [invoice] = await tx
      .update(invoices)
      .set({
        status: "paid",
        paidAt: now,
        provider: payment.provider,
        providerRef: providerRef ?? payment.providerRef,
      })
      .where(eq(invoices.id, payment.invoiceId))
      .returning();
    const plan = await getPlan(tx, invoice!.planId);
    if (!plan) throw new Error(`plan ${invoice!.planId} missing`);

    await writeAudit(tx, {
      merchantId: payment.merchantId,
      actorUserId: actor.userId ?? null,
      actorType: actor.type,
      action: "payment.succeeded",
      details: {
        paymentId,
        invoice: invoice!.number,
        provider: payment.provider,
        amountMinor: payment.amountMinor,
      },
    });

    const applied = await applyAccountEvent(
      payment.merchantId,
      {
        type: "payment_confirmed",
        at: now,
        planId: plan.id,
        interval: { unit: plan.interval, count: plan.intervalCount },
      },
      actor,
      tx,
    );
    return { ok: true, alreadySettled: false, applied } as const;
  });
}

/** Failed at the gateway, canceled by the payer, or rejected by an admin. Never undoes a success. */
export async function failPayment(
  paymentId: string,
  status: "failed" | "rejected",
  actor: Actor,
  note?: string,
): Promise<boolean> {
  return serviceDb.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .for("update");
    if (!payment || payment.status === "succeeded") return false;
    await tx
      .update(payments)
      .set({
        status,
        reviewNote: note ?? null,
        reviewedBy: actor.type === "admin" ? (actor.userId ?? null) : null,
        reviewedAt: actor.type === "admin" ? new Date() : null,
      })
      .where(eq(payments.id, paymentId));
    await writeAudit(tx, {
      merchantId: payment.merchantId,
      actorUserId: actor.userId ?? null,
      actorType: actor.type,
      action: `payment.${status}`,
      details: { paymentId, provider: payment.provider },
    });
    return true;
  });
}
