"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/log";
import { adminAction } from "@/lib/auth/action-context";
import { applyAccountEvent } from "@/lib/billing/account-service";
import { dispatchAccountEffects, notifyPaymentRejected } from "@/lib/billing/notify";
import { failPayment, settlePayment } from "@/lib/billing/payments";
import { serviceDb } from "@/lib/db/client";
import { payments, plans } from "@/lib/db/schema";
import { cleanText } from "@/lib/validation/text";

export type AdminResult =
  { ok: true } | { ok: false; error: "forbidden" | "not_found" | "invalid" | "generic" | string };

const id = z.string().uuid();

function refresh() {
  revalidatePath("/[locale]/admin", "layout");
}

export async function setMerchantSuspendedAction(
  merchantId: string,
  suspended: boolean,
): Promise<AdminResult> {
  const admin = await adminAction();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!id.safeParse(merchantId).success) return { ok: false, error: "invalid" };
  const result = await applyAccountEvent(
    merchantId,
    { type: suspended ? "admin_suspend" : "admin_reactivate", at: new Date() },
    { type: "admin", userId: admin.id },
  );
  if (!result.ok) return { ok: false, error: result.error };
  await dispatchAccountEffects(merchantId, result.effects);
  refresh();
  return { ok: true };
}

export async function approvePaymentAction(paymentId: string): Promise<AdminResult> {
  const admin = await adminAction();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!id.safeParse(paymentId).success) return { ok: false, error: "invalid" };
  const result = await settlePayment(paymentId, { type: "admin", userId: admin.id });
  if (!result.ok) return { ok: false, error: "not_found" };
  if (result.applied?.ok)
    await dispatchAccountEffects(result.applied.merchantId, result.applied.effects);
  refresh();
  return { ok: true };
}

export async function rejectPaymentAction(
  paymentId: string,
  rawNote: string,
): Promise<AdminResult> {
  const admin = await adminAction();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!id.safeParse(paymentId).success) return { ok: false, error: "invalid" };
  const note = cleanText(rawNote).slice(0, 300) || null;
  const [payment] = await serviceDb
    .select({ merchantId: payments.merchantId })
    .from(payments)
    .where(eq(payments.id, paymentId));
  if (!payment) return { ok: false, error: "not_found" };
  const changed = await failPayment(
    paymentId,
    "rejected",
    { type: "admin", userId: admin.id },
    note ?? undefined,
  );
  if (!changed) return { ok: false, error: "not_found" };
  await notifyPaymentRejected(payment.merchantId, note);
  refresh();
  return { ok: true };
}

const planSchema = z.object({
  priceMinor: z.number().int().min(0).max(100_000_000),
  trialDays: z.number().int().min(0).max(90),
  maxItems: z.number().int().min(1).max(5000),
  maxStaff: z.number().int().min(0).max(500),
  maxMonthlyOrders: z.number().int().min(1).max(10_000_000).nullable(),
  isActive: z.boolean(),
});

export async function updatePlanAction(
  planId: string,
  input: z.input<typeof planSchema>,
): Promise<AdminResult> {
  const admin = await adminAction();
  if (!admin) return { ok: false, error: "forbidden" };
  const parsed = planSchema.safeParse(input);
  if (!id.safeParse(planId).success || !parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const [updated] = await serviceDb
    .update(plans)
    .set({
      priceMinor: v.priceMinor,
      trialDays: v.trialDays,
      isActive: v.isActive,
      limits: { maxItems: v.maxItems, maxStaff: v.maxStaff, maxMonthlyOrders: v.maxMonthlyOrders },
    })
    .where(eq(plans.id, planId))
    .returning({ code: plans.code });
  if (!updated) return { ok: false, error: "not_found" };
  await writeAudit(serviceDb, {
    actorUserId: admin.id,
    actorType: "admin",
    action: "plan.updated",
    details: { plan: updated.code, ...v },
  });
  refresh();
  return { ok: true };
}
