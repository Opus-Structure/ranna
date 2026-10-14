/**
 * Subscription / account state machine (D12). Pure: no I/O, no clock. Every account state change
 * in the app goes through `transition`, called only by `applyAccountEvent`.
 *
 *   pending_payment ──payment──▶ active ──period ends──▶ past_due ──grace ends──▶ suspended
 *        ▲  │trial                 │ ▲ payment              │ payment               │ payment
 *        │  ▼                      │ └──────────────────────┘◀──────────────────────┘
 *        └─ active (trial) ──trial ends without payment
 *   active + cancel_at_period_end ──period ends──▶ canceled ──payment──▶ active
 */

export type AccountStatus = "pending_payment" | "active" | "past_due" | "suspended" | "canceled";

export type BillingInterval = { unit: "month" | "year"; count: number };

export type AccountSnapshot = {
  status: AccountStatus;
  planId: string | null;
  pendingPlanId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  graceUntil: Date | null;
  isTrial: boolean;
  trialUsed: boolean;
  cancelAtPeriodEnd: boolean;
};

export type AccountEvent =
  | { type: "payment_confirmed"; at: Date; planId: string; interval: BillingInterval }
  | { type: "trial_started"; at: Date; planId: string; trialDays: number }
  | { type: "period_check"; at: Date }
  | { type: "cancel_requested"; at: Date }
  | { type: "cancel_reverted"; at: Date }
  | { type: "plan_change_requested"; at: Date; planId: string }
  | { type: "admin_suspend"; at: Date }
  | { type: "admin_reactivate"; at: Date };

export type AccountEffect =
  | "activated"
  | "renewed"
  | "trial_started"
  | "trial_expired"
  | "past_due"
  | "suspended"
  | "canceled"
  | "reactivated";

export type TransitionResult =
  | { ok: true; changed: boolean; next: AccountSnapshot; effects: AccountEffect[] }
  | { ok: false; error: TransitionError };

export type TransitionError =
  | "trial_already_used"
  | "trial_not_available"
  | "not_cancelable"
  | "nothing_to_revert"
  | "already_suspended"
  | "not_suspended"
  | "invalid_plan_change";

export type BillingPolicy = { graceDays: number };

const DAY = 24 * 60 * 60 * 1000;

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY);
}

/** Calendar add that clamps to month end (Jan 31 + 1 month = Feb 28/29). */
export function addInterval(at: Date, { unit, count }: BillingInterval): Date {
  const d = new Date(at.getTime());
  const months = unit === "year" ? 12 * count : count;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

const ok = (
  prev: AccountSnapshot,
  next: AccountSnapshot,
  effects: AccountEffect[] = [],
): TransitionResult => ({
  ok: true,
  changed: JSON.stringify(prev) !== JSON.stringify(next),
  next,
  effects,
});

const fail = (error: TransitionError): TransitionResult => ({ ok: false, error });

export function transition(
  s: AccountSnapshot,
  event: AccountEvent,
  policy: BillingPolicy,
): TransitionResult {
  switch (event.type) {
    case "payment_confirmed": {
      // Paying early extends the current paid (or trial) period instead of discarding it.
      const running =
        (s.status === "active" || s.status === "past_due") && s.periodEnd && s.periodEnd > event.at;
      const start = running ? s.periodEnd! : event.at;
      const effect: AccountEffect =
        s.status === "suspended" || s.status === "canceled"
          ? "reactivated"
          : (s.status === "active" && !s.isTrial) || s.status === "past_due"
            ? "renewed"
            : "activated";
      return ok(
        s,
        {
          ...s,
          status: "active",
          planId: event.planId,
          pendingPlanId: null,
          periodStart: running && s.periodStart ? s.periodStart : event.at,
          periodEnd: addInterval(start, event.interval),
          graceUntil: null,
          isTrial: false,
          cancelAtPeriodEnd: false,
        },
        [effect],
      );
    }

    case "trial_started": {
      if (s.trialUsed) return fail("trial_already_used");
      if (s.status !== "pending_payment" || event.trialDays <= 0)
        return fail("trial_not_available");
      return ok(
        s,
        {
          ...s,
          status: "active",
          planId: event.planId,
          periodStart: event.at,
          periodEnd: addDays(event.at, event.trialDays),
          graceUntil: null,
          isTrial: true,
          trialUsed: true,
          cancelAtPeriodEnd: false,
        },
        ["trial_started"],
      );
    }

    case "period_check": {
      if (s.status === "active" && s.periodEnd && event.at >= s.periodEnd) {
        if (s.cancelAtPeriodEnd) {
          return ok(s, { ...s, status: "canceled", isTrial: false, cancelAtPeriodEnd: false }, [
            "canceled",
          ]);
        }
        if (s.isTrial) {
          return ok(s, { ...s, status: "pending_payment", isTrial: false }, ["trial_expired"]);
        }
        return ok(
          s,
          { ...s, status: "past_due", graceUntil: addDays(s.periodEnd, policy.graceDays) },
          ["past_due"],
        );
      }
      if (s.status === "past_due" && s.graceUntil && event.at >= s.graceUntil) {
        return ok(s, { ...s, status: "suspended" }, ["suspended"]);
      }
      return ok(s, s);
    }

    case "cancel_requested": {
      if (s.status === "active") {
        // Trials end immediately on cancel; paid periods run to their end.
        if (s.isTrial) return ok(s, { ...s, status: "canceled", isTrial: false }, ["canceled"]);
        return ok(s, { ...s, cancelAtPeriodEnd: true });
      }
      if (s.status === "past_due" || s.status === "suspended") {
        return ok(s, { ...s, status: "canceled", graceUntil: null, cancelAtPeriodEnd: false }, [
          "canceled",
        ]);
      }
      return fail("not_cancelable");
    }

    case "cancel_reverted": {
      if (s.status === "active" && s.cancelAtPeriodEnd)
        return ok(s, { ...s, cancelAtPeriodEnd: false });
      return fail("nothing_to_revert");
    }

    case "plan_change_requested": {
      if (event.planId === s.planId) return ok(s, { ...s, pendingPlanId: null });
      if (s.status === "canceled") return fail("invalid_plan_change");
      return ok(s, { ...s, pendingPlanId: event.planId });
    }

    case "admin_suspend": {
      if (s.status === "suspended") return fail("already_suspended");
      return ok(s, { ...s, status: "suspended", graceUntil: null }, ["suspended"]);
    }

    case "admin_reactivate": {
      if (s.status !== "suspended") return fail("not_suspended");
      const paidUp = s.periodEnd !== null && s.periodEnd > event.at;
      return ok(
        s,
        { ...s, status: paidUp ? "active" : "pending_payment" },
        paidUp ? ["reactivated"] : [],
      );
    }
  }
}

/** What the account may do right now (D11). */
export type AccountAccess = {
  /** Public shop page is up and accepts orders. */
  shopLive: boolean;
  /** Dashboard edits allowed (billing is always allowed). */
  canEdit: boolean;
  /** Days left before suspension when past_due, else null. */
  graceDaysLeft: number | null;
};

export function accountAccess(
  s: Pick<AccountSnapshot, "status" | "graceUntil">,
  at: Date,
): AccountAccess {
  const inGrace = s.status === "past_due" && s.graceUntil !== null && s.graceUntil > at;
  const live = s.status === "active" || inGrace;
  return {
    shopLive: live,
    canEdit: live,
    graceDaysLeft: inGrace ? Math.ceil((s.graceUntil!.getTime() - at.getTime()) / DAY) : null,
  };
}
