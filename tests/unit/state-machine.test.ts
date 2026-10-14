import { describe, expect, it } from "vitest";
import {
  accountAccess,
  addInterval,
  transition,
  type AccountEvent,
  type AccountSnapshot,
} from "@/lib/billing/state-machine";

const policy = { graceDays: 5 };
const monthly = { unit: "month", count: 1 } as const;
const t0 = new Date("2026-10-13T10:00:00Z");
const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);

const fresh: AccountSnapshot = {
  status: "pending_payment",
  planId: null,
  pendingPlanId: null,
  periodStart: null,
  periodEnd: null,
  graceUntil: null,
  isTrial: false,
  trialUsed: false,
  cancelAtPeriodEnd: false,
};

function run(s: AccountSnapshot, e: AccountEvent) {
  const r = transition(s, e, policy);
  if (!r.ok) throw new Error(`unexpected ${r.error}`);
  return r;
}

const paid = run(fresh, {
  type: "payment_confirmed",
  at: t0,
  planId: "pro",
  interval: monthly,
}).next;

describe("addInterval", () => {
  it("adds calendar months and clamps to month end", () => {
    expect(addInterval(new Date("2026-01-31T12:00:00Z"), monthly).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
    expect(addInterval(new Date("2028-01-31T12:00:00Z"), monthly).toISOString()).toBe(
      "2028-02-29T12:00:00.000Z",
    );
    expect(
      addInterval(new Date("2026-10-13T10:00:00Z"), { unit: "year", count: 1 }).toISOString(),
    ).toBe("2027-10-13T10:00:00.000Z");
  });
});

describe("payment_confirmed", () => {
  it("activates a new account for one interval", () => {
    const r = run(fresh, { type: "payment_confirmed", at: t0, planId: "pro", interval: monthly });
    expect(r.next.status).toBe("active");
    expect(r.next.planId).toBe("pro");
    expect(r.next.periodEnd?.toISOString()).toBe("2026-11-13T10:00:00.000Z");
    expect(r.effects).toEqual(["activated"]);
  });

  it("extends from the current period end when paying early", () => {
    const r = run(paid, {
      type: "payment_confirmed",
      at: days(20),
      planId: "pro",
      interval: monthly,
    });
    expect(r.next.periodEnd?.toISOString()).toBe("2026-12-13T10:00:00.000Z");
    expect(r.effects).toEqual(["renewed"]);
  });

  it("restarts from the payment date when the period already ended", () => {
    const pastDue = run(paid, { type: "period_check", at: days(31) }).next;
    const r = run(pastDue, {
      type: "payment_confirmed",
      at: days(33),
      planId: "pro",
      interval: monthly,
    });
    expect(r.next.status).toBe("active");
    expect(r.next.graceUntil).toBeNull();
    expect(r.next.periodEnd?.toISOString()).toBe("2026-12-15T10:00:00.000Z");
    expect(r.effects).toEqual(["renewed"]);
  });

  it("reactivates suspended and canceled accounts", () => {
    for (const status of ["suspended", "canceled"] as const) {
      const r = run(
        { ...paid, status },
        { type: "payment_confirmed", at: days(60), planId: "starter", interval: monthly },
      );
      expect(r.next.status).toBe("active");
      expect(r.next.planId).toBe("starter");
      expect(r.effects).toEqual(["reactivated"]);
    }
  });

  it("keeps remaining trial days and clears trial + pending plan + cancellation", () => {
    const trial = run(fresh, { type: "trial_started", at: t0, planId: "pro", trialDays: 14 }).next;
    const r = run(
      { ...trial, pendingPlanId: "business", cancelAtPeriodEnd: true },
      { type: "payment_confirmed", at: days(4), planId: "business", interval: monthly },
    );
    expect(r.next.isTrial).toBe(false);
    expect(r.next.pendingPlanId).toBeNull();
    expect(r.next.cancelAtPeriodEnd).toBe(false);
    expect(r.next.periodEnd?.toISOString()).toBe("2026-11-27T10:00:00.000Z");
    expect(r.effects).toEqual(["activated"]);
  });
});

describe("trials", () => {
  it("start once, from pending_payment only", () => {
    const r = run(fresh, { type: "trial_started", at: t0, planId: "pro", trialDays: 14 });
    expect(r.next).toMatchObject({ status: "active", isTrial: true, trialUsed: true });
    expect(r.next.periodEnd?.toISOString()).toBe("2026-10-27T10:00:00.000Z");
    const again = transition(
      { ...r.next, status: "pending_payment" },
      { type: "trial_started", at: days(30), planId: "pro", trialDays: 14 },
      policy,
    );
    expect(again).toEqual({ ok: false, error: "trial_already_used" });
    expect(
      transition(paid, { type: "trial_started", at: t0, planId: "pro", trialDays: 14 }, policy),
    ).toEqual({
      ok: false,
      error: "trial_not_available",
    });
    expect(
      transition(fresh, { type: "trial_started", at: t0, planId: "x", trialDays: 0 }, policy),
    ).toEqual({
      ok: false,
      error: "trial_not_available",
    });
  });

  it("expire back to pending_payment, never past_due", () => {
    const trial = run(fresh, { type: "trial_started", at: t0, planId: "pro", trialDays: 14 }).next;
    const r = run(trial, { type: "period_check", at: days(14) });
    expect(r.next.status).toBe("pending_payment");
    expect(r.next.isTrial).toBe(false);
    expect(r.effects).toEqual(["trial_expired"]);
  });
});

describe("period_check (daily cron)", () => {
  it("does nothing while the period runs", () => {
    const r = run(paid, { type: "period_check", at: days(10) });
    expect(r.changed).toBe(false);
    expect(r.effects).toEqual([]);
  });

  it("moves to past_due with a grace window, then suspends", () => {
    const pastDue = run(paid, { type: "period_check", at: days(31) });
    expect(pastDue.next.status).toBe("past_due");
    expect(pastDue.next.graceUntil?.toISOString()).toBe("2026-11-18T10:00:00.000Z");
    expect(run(pastDue.next, { type: "period_check", at: days(34) }).changed).toBe(false);
    const suspended = run(pastDue.next, { type: "period_check", at: days(36) });
    expect(suspended.next.status).toBe("suspended");
    expect(suspended.effects).toEqual(["suspended"]);
  });

  it("is idempotent when run twice", () => {
    const once = run(paid, { type: "period_check", at: days(31) }).next;
    const twice = run(once, { type: "period_check", at: days(31) });
    expect(twice.changed).toBe(false);
  });

  it("ends a canceled subscription at period end", () => {
    const canceling = run(paid, { type: "cancel_requested", at: days(3) }).next;
    expect(canceling.status).toBe("active");
    const r = run(canceling, { type: "period_check", at: days(31) });
    expect(r.next.status).toBe("canceled");
    expect(r.effects).toEqual(["canceled"]);
  });
});

describe("cancellation", () => {
  it("can be reverted before the period ends", () => {
    const canceling = run(paid, { type: "cancel_requested", at: days(3) }).next;
    expect(run(canceling, { type: "cancel_reverted", at: days(4) }).next.cancelAtPeriodEnd).toBe(
      false,
    );
    expect(transition(paid, { type: "cancel_reverted", at: days(4) }, policy)).toEqual({
      ok: false,
      error: "nothing_to_revert",
    });
  });

  it("ends trials and unpaid accounts immediately", () => {
    const trial = run(fresh, { type: "trial_started", at: t0, planId: "pro", trialDays: 14 }).next;
    expect(run(trial, { type: "cancel_requested", at: days(1) }).next.status).toBe("canceled");
    const pastDue = run(paid, { type: "period_check", at: days(31) }).next;
    expect(run(pastDue, { type: "cancel_requested", at: days(32) }).next.status).toBe("canceled");
  });

  it("is refused for accounts that never paid or are already canceled", () => {
    expect(transition(fresh, { type: "cancel_requested", at: t0 }, policy)).toEqual({
      ok: false,
      error: "not_cancelable",
    });
    expect(
      transition({ ...paid, status: "canceled" }, { type: "cancel_requested", at: t0 }, policy),
    ).toEqual({
      ok: false,
      error: "not_cancelable",
    });
  });
});

describe("plan changes", () => {
  it("queue for the next payment", () => {
    const r = run(paid, { type: "plan_change_requested", at: days(2), planId: "business" });
    expect(r.next.pendingPlanId).toBe("business");
    expect(r.next.planId).toBe("pro");
    expect(
      run(r.next, { type: "plan_change_requested", at: days(3), planId: "pro" }).next.pendingPlanId,
    ).toBeNull();
  });
});

describe("admin actions", () => {
  it("suspend from any state and reactivate to the right state", () => {
    const s = run(paid, { type: "admin_suspend", at: days(2) });
    expect(s.next.status).toBe("suspended");
    expect(transition(s.next, { type: "admin_suspend", at: days(2) }, policy)).toEqual({
      ok: false,
      error: "already_suspended",
    });
    expect(run(s.next, { type: "admin_reactivate", at: days(3) }).next.status).toBe("active");
    expect(run(s.next, { type: "admin_reactivate", at: days(40) }).next.status).toBe(
      "pending_payment",
    );
    expect(transition(paid, { type: "admin_reactivate", at: days(3) }, policy)).toEqual({
      ok: false,
      error: "not_suspended",
    });
  });
});

describe("accountAccess", () => {
  it("keeps the shop live through the grace period only", () => {
    expect(accountAccess(paid, days(1))).toEqual({
      shopLive: true,
      canEdit: true,
      graceDaysLeft: null,
    });
    const pastDue = run(paid, { type: "period_check", at: days(31) }).next;
    expect(accountAccess(pastDue, days(31))).toMatchObject({ shopLive: true, graceDaysLeft: 5 });
    expect(accountAccess(pastDue, days(36))).toMatchObject({ shopLive: false, canEdit: false });
    for (const status of ["pending_payment", "suspended", "canceled"] as const) {
      expect(accountAccess({ status, graceUntil: null }, t0).shopLive).toBe(false);
    }
  });
});
