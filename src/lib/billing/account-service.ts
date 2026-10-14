import "server-only";
import { eq } from "drizzle-orm";
import { billingConfig } from "@/config/billing";
import { writeAudit } from "@/lib/audit/log";
import { serviceDb, type Tx } from "@/lib/db/client";
import { merchants, subscriptions } from "@/lib/db/schema";
import {
  transition,
  type AccountEvent,
  type AccountSnapshot,
  type TransitionResult,
} from "./state-machine";

export type Actor = {
  type: "user" | "admin" | "system" | "webhook";
  userId?: string | null;
};

export type AppliedEvent = TransitionResult & { merchantId: string; from?: AccountSnapshot };

async function lockSnapshot(tx: Tx, merchantId: string): Promise<AccountSnapshot | null> {
  const [m] = await tx
    .select({
      status: merchants.status,
      planId: merchants.planId,
      periodEnd: merchants.periodEnd,
      graceUntil: merchants.graceUntil,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .for("update");
  if (!m) return null;
  const [sub] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.merchantId, merchantId))
    .for("update");
  return {
    status: m.status,
    planId: sub?.planId ?? m.planId,
    pendingPlanId: sub?.pendingPlanId ?? null,
    periodStart: sub?.currentPeriodStart ?? null,
    periodEnd: m.periodEnd,
    graceUntil: m.graceUntil,
    isTrial: sub?.isTrial ?? false,
    trialUsed: sub?.trialUsed ?? false,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  };
}

/**
 * The single entry point for account state changes: locks the merchant row, runs the pure
 * state machine, persists merchant + subscription, and writes the audit log, in one
 * transaction. Pass `tx` to join a caller's transaction (e.g. payment settlement).
 */
export async function applyAccountEvent(
  merchantId: string,
  event: AccountEvent,
  actor: Actor,
  tx?: Tx,
): Promise<AppliedEvent> {
  const run = async (db: Tx): Promise<AppliedEvent> => {
    const from = await lockSnapshot(db, merchantId);
    if (!from) throw new Error(`merchant ${merchantId} not found`);
    const result = transition(from, event, { graceDays: billingConfig.graceDays });
    if (!result.ok || !result.changed) return { ...result, merchantId, from };

    const next = result.next;
    await db
      .update(merchants)
      .set({
        status: next.status,
        planId: next.planId,
        periodEnd: next.periodEnd,
        graceUntil: next.graceUntil,
      })
      .where(eq(merchants.id, merchantId));

    if (next.planId) {
      const values = {
        planId: next.planId,
        pendingPlanId: next.pendingPlanId,
        isTrial: next.isTrial,
        trialUsed: next.trialUsed,
        currentPeriodStart: next.periodStart,
        currentPeriodEnd: next.periodEnd,
        cancelAtPeriodEnd: next.cancelAtPeriodEnd,
      };
      await db
        .insert(subscriptions)
        .values({ merchantId, ...values })
        .onConflictDoUpdate({ target: subscriptions.merchantId, set: values });
    }

    await writeAudit(db, {
      merchantId,
      actorUserId: actor.userId ?? null,
      actorType: actor.type,
      action: `account.${event.type}`,
      fromState: from.status,
      toState: next.status,
      details: {
        effects: result.effects,
        planId: next.planId,
        periodEnd: next.periodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: next.cancelAtPeriodEnd,
      },
    });
    return { ...result, merchantId, from };
  };
  return tx ? run(tx) : serviceDb.transaction(run);
}
