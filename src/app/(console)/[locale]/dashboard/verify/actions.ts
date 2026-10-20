"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "@/lib/audit/log";
import { ownerAction } from "@/lib/auth/action-context";
import { applyAccountEvent } from "@/lib/billing/account-service";
import { dispatchAccountEffects } from "@/lib/billing/notify";
import { serviceDb } from "@/lib/db/client";
import { merchants, plans } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env";
import { checkUpload, MB } from "@/lib/files/sniff";
import { clientIp, hashIdentifier } from "@/lib/http/request";
import { checkLimit } from "@/lib/rate-limit";
import { putObject, removeObject } from "@/lib/storage/objects";

export type VerifyError =
  | "forbidden"
  | "already_submitted"
  | "number_invalid"
  | "number_taken"
  | "file_missing"
  | "file_too_large"
  | "file_bad_type"
  | "rate_limited"
  | "generic";

export type VerifyResult = { ok: true } | { ok: false; error: VerifyError };

/** Letters and digits only, upper-case: "16/00-0123456 B 20" and "16 00 0123456 b20" match. */
function normalizeRegisterNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * The commercial register comes first: it is the one thing a repeat sign-up cannot fake twice,
 * so the free trial starts here (15 days, no payment) and only once per register number.
 */
export async function submitRegisterAction(form: FormData): Promise<VerifyResult> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  if (ctx.merchant.registerSubmittedAt) return { ok: false, error: "already_submitted" };

  const number = normalizeRegisterNumber(String(form.get("registerNumber") ?? ""));
  if (number.length < 6 || number.length > 30) return { ok: false, error: "number_invalid" };

  const ip = hashIdentifier(clientIp(await headers()), serverEnv().APP_SECRET);
  if (!(await checkLimit("receiptUpload", `${ctx.merchant.id}:${ip}`)).ok)
    return { ok: false, error: "rate_limited" };

  const upload = await checkUpload(form.get("register"), {
    maxBytes: 5 * MB,
    allow: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  });
  if (!upload.ok) return { ok: false, error: `file_${upload.error}` as VerifyError };

  const [taken] = await serviceDb
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.registerNumber, number))
    .limit(1);
  if (taken) return { ok: false, error: "number_taken" };

  const path = `registers/${ctx.merchant.id}.${upload.type.ext}`;
  try {
    await putObject("receipts", path, upload.bytes, upload.type.mime);
  } catch (err) {
    console.error("register upload failed", { error: err instanceof Error ? err.message : err });
    return { ok: false, error: "generic" };
  }

  try {
    // The unique index is the real guard: two sign-ups racing on one number cannot both win.
    const updated = await serviceDb
      .update(merchants)
      .set({ registerNumber: number, registerPath: path, registerSubmittedAt: new Date() })
      .where(and(eq(merchants.id, ctx.merchant.id), isNull(merchants.registerSubmittedAt)))
      .returning({ id: merchants.id });
    if (updated.length === 0) return { ok: false, error: "already_submitted" };
  } catch (err) {
    await removeObject("receipts", path).catch(() => undefined);
    if ((err as { code?: string }).code === "23505") return { ok: false, error: "number_taken" };
    console.error("register save failed", { error: err instanceof Error ? err.message : err });
    return { ok: false, error: "generic" };
  }

  await writeAudit(serviceDb, {
    merchantId: ctx.merchant.id,
    actorUserId: ctx.user.id,
    actorType: "user",
    action: "register.submitted",
    details: { registerNumber: number },
  });

  // The trial runs on the main pack (Diamant) for the plan's own trial length.
  const active = await serviceDb
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sort));
  const trialPlan = active.find((p) => p.code === "diamant") ?? active[0];
  if (trialPlan && trialPlan.trialDays > 0) {
    const result = await applyAccountEvent(
      ctx.merchant.id,
      {
        type: "trial_started",
        at: new Date(),
        planId: trialPlan.id,
        trialDays: trialPlan.trialDays,
      },
      { type: "user", userId: ctx.user.id },
    );
    if (result.ok) await dispatchAccountEffects(ctx.merchant.id, result.effects);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
