"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { appUrl } from "@/config/brand";
import { isAppLocale } from "@/i18n/routing";
import { writeAudit } from "@/lib/audit/log";
import { ownerAction } from "@/lib/auth/action-context";
import { localizedPath } from "@/lib/auth/paths";
import { applyAccountEvent } from "@/lib/billing/account-service";
import { dispatchAccountEffects } from "@/lib/billing/notify";
import { createPayment, getPlan, openInvoice } from "@/lib/billing/payments";
import { getProvider } from "@/lib/billing/providers";
import type { AccountEvent, TransitionError } from "@/lib/billing/state-machine";
import { serviceDb } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env";
import { checkUpload, MB } from "@/lib/files/sniff";
import { clientIp, hashIdentifier } from "@/lib/http/request";
import { checkLimit } from "@/lib/rate-limit";
import { putObject } from "@/lib/storage/objects";
import { cleanText } from "@/lib/validation/text";

export type BillingError =
  | TransitionError
  | "forbidden"
  | "plan_unavailable"
  | "provider_unavailable"
  | "receipt_missing"
  | "receipt_too_large"
  | "receipt_bad_type"
  | "receipt_duplicate"
  | "reference_too_long"
  | "already_pending"
  | "rate_limited"
  | "generic";

export type BillingResult = { ok: true; redirectUrl?: string } | { ok: false; error: BillingError };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function activePlan(planId: unknown) {
  if (typeof planId !== "string" || !uuid.test(planId)) return null;
  const plan = await getPlan(serviceDb, planId);
  return plan?.isActive ? plan : null;
}

function refresh() {
  revalidatePath("/[locale]/dashboard", "layout");
}

/** Starts a hosted checkout (mock locally, Chargily in production). */
export async function payOnlineAction(
  rawLocale: string,
  planId: string,
  providerId: string,
): Promise<BillingResult> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  const locale = isAppLocale(rawLocale) ? rawLocale : "ar";
  const plan = await activePlan(planId);
  if (!plan) return { ok: false, error: "plan_unavailable" };
  const provider = getProvider(providerId);
  if (!provider || provider.kind !== "redirect" || !provider.startCheckout) {
    return { ok: false, error: "provider_unavailable" };
  }

  const { invoice, payment } = await serviceDb.transaction(async (tx) => {
    const invoice = await openInvoice(tx, ctx.merchant.id, plan);
    const payment = await createPayment(tx, { invoice, provider: provider.id });
    return { invoice, payment };
  });
  const billing = `${appUrl()}${localizedPath("/dashboard/billing", locale)}`;
  try {
    const checkout = await provider.startCheckout({
      paymentId: payment.id,
      invoiceNumber: invoice.number,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      locale,
      successUrl: `${billing}?checkout=success`,
      failureUrl: `${billing}?checkout=failed`,
      webhookUrl: `${appUrl()}/api/webhooks/${provider.id}`,
    });
    await serviceDb
      .update(payments)
      .set({ providerRef: checkout.providerRef })
      .where(eq(payments.id, payment.id));
    await writeAudit(serviceDb, {
      merchantId: ctx.merchant.id,
      actorUserId: ctx.user.id,
      actorType: "user",
      action: "checkout.started",
      details: { provider: provider.id, invoice: invoice.number, paymentId: payment.id },
    });
    return { ok: true, redirectUrl: checkout.redirectUrl };
  } catch (err) {
    await serviceDb.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
    console.error("checkout start failed", {
      provider: provider.id,
      error: err instanceof Error ? err.message : err,
    });
    return { ok: false, error: "provider_unavailable" };
  }
}

/** Bank transfer / BaridiMob / cash: the receipt goes to the platform admin for approval. */
export async function submitManualPaymentAction(form: FormData): Promise<BillingResult> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (!getProvider("manual")) return { ok: false, error: "provider_unavailable" };
  const plan = await activePlan(form.get("planId"));
  if (!plan) return { ok: false, error: "plan_unavailable" };
  const reference = cleanText(String(form.get("reference") ?? ""));
  if (reference.length > 120) return { ok: false, error: "reference_too_long" };

  const ip = hashIdentifier(clientIp(await headers()), serverEnv().APP_SECRET);
  if (!(await checkLimit("receiptUpload", `${ctx.merchant.id}:${ip}`)).ok)
    return { ok: false, error: "rate_limited" };

  const upload = await checkUpload(form.get("receipt"), {
    maxBytes: 5 * MB,
    allow: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  });
  if (!upload.ok) return { ok: false, error: `receipt_${upload.error}` as BillingError };

  // Automatic check: a receipt file that already backs another payment is never accepted again.
  const receiptHash = createHash("sha256").update(upload.bytes).digest("hex");
  const [reused] = await serviceDb
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.receiptHash, receiptHash))
    .limit(1);
  if (reused) return { ok: false, error: "receipt_duplicate" };

  const existing = await serviceDb
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(eq(payments.merchantId, ctx.merchant.id));
  if (existing.some((p) => p.status === "pending_review"))
    return { ok: false, error: "already_pending" };

  const { payment } = await serviceDb.transaction(async (tx) => {
    const invoice = await openInvoice(tx, ctx.merchant.id, plan);
    const payment = await createPayment(tx, {
      invoice,
      provider: "manual",
      status: "pending_review",
      reference,
    });
    return { payment };
  });
  const path = `${ctx.merchant.id}/${payment.id}.${upload.type.ext}`;
  try {
    await putObject("receipts", path, upload.bytes, upload.type.mime);
  } catch (err) {
    await serviceDb.delete(payments).where(eq(payments.id, payment.id));
    console.error("receipt upload failed", { error: err instanceof Error ? err.message : err });
    return { ok: false, error: "generic" };
  }
  await serviceDb
    .update(payments)
    .set({ receiptPath: path, receiptHash })
    .where(eq(payments.id, payment.id));
  await writeAudit(serviceDb, {
    merchantId: ctx.merchant.id,
    actorUserId: ctx.user.id,
    actorType: "user",
    action: "payment.submitted",
    details: { provider: "manual", paymentId: payment.id },
  });
  refresh();
  return { ok: true };
}

async function accountAction(
  build: (planId?: string) => AccountEvent | null,
  planId?: string,
): Promise<BillingResult> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  const event = build(planId);
  if (!event) return { ok: false, error: "plan_unavailable" };
  const result = await applyAccountEvent(ctx.merchant.id, event, {
    type: "user",
    userId: ctx.user.id,
  });
  if (!result.ok) return { ok: false, error: result.error };
  await dispatchAccountEffects(ctx.merchant.id, result.effects);
  refresh();
  return { ok: true };
}

export async function startTrialAction(planId: string): Promise<BillingResult> {
  const plan = await activePlan(planId);
  if (!plan) return { ok: false, error: "plan_unavailable" };
  return accountAction(() => ({
    type: "trial_started",
    at: new Date(),
    planId: plan.id,
    trialDays: plan.trialDays,
  }));
}

export async function changePlanAction(planId: string): Promise<BillingResult> {
  const plan = await activePlan(planId);
  if (!plan) return { ok: false, error: "plan_unavailable" };
  return accountAction(() => ({ type: "plan_change_requested", at: new Date(), planId: plan.id }));
}

export async function cancelSubscriptionAction(): Promise<BillingResult> {
  return accountAction(() => ({ type: "cancel_requested", at: new Date() }));
}

export async function revertCancelAction(): Promise<BillingResult> {
  return accountAction(() => ({ type: "cancel_reverted", at: new Date() }));
}
