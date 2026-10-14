/**
 * Billing against the real database: audited state changes, idempotent settlement and the
 * signed webhook pipeline (verify → record once → settle → acknowledge replays).
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAccountEvent } from "@/lib/billing/account-service";
import {
  createPayment,
  failPayment,
  getPlan,
  openInvoice,
  settlePayment,
} from "@/lib/billing/payments";
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from "@/lib/billing/providers/mock";
import { handleProviderWebhook } from "@/lib/billing/webhooks";
import { closeDb, serviceDb } from "@/lib/db/client";
import {
  auditLogs,
  invoices,
  merchantMembers,
  merchants,
  payments,
  plans,
  subscriptions,
} from "@/lib/db/schema";
import { createAuthUser, deleteAuthUsers } from "./fixtures";

const users: string[] = [];
const merchantIds: string[] = [];
let planId: string;

async function newMerchant(label: string) {
  const owner = await createAuthUser(label);
  users.push(owner);
  const [m] = await serviceDb
    .insert(merchants)
    .values({ name: `${label} shop` })
    .returning({ id: merchants.id });
  await serviceDb
    .insert(merchantMembers)
    .values({ merchantId: m!.id, userId: owner, role: "owner" });
  merchantIds.push(m!.id);
  return m!.id;
}

async function merchantRow(id: string) {
  const [m] = await serviceDb.select().from(merchants).where(eq(merchants.id, id));
  return m!;
}

beforeAll(async () => {
  process.env.PAYMENT_PROVIDERS = "mock,manual";
  const [p] = await serviceDb
    .insert(plans)
    .values({
      code: `billing-test-${randomUUID().slice(0, 8)}`,
      name: "Billing test",
      priceMinor: 290000,
      trialDays: 14,
      limits: { maxItems: 10, maxStaff: 1, maxMonthlyOrders: null },
      isActive: false,
    })
    .returning({ id: plans.id });
  planId = p!.id;
});

afterAll(async () => {
  for (const id of merchantIds) await serviceDb.delete(merchants).where(eq(merchants.id, id));
  await serviceDb.delete(plans).where(eq(plans.id, planId));
  await deleteAuthUsers(users);
  await closeDb();
});

describe("applyAccountEvent", () => {
  it("persists merchant + subscription and writes the audit log", async () => {
    const id = await newMerchant("trial");
    const r = await applyAccountEvent(
      id,
      { type: "trial_started", at: new Date(), planId, trialDays: 14 },
      { type: "user" },
    );
    expect(r.ok).toBe(true);
    const m = await merchantRow(id);
    expect(m.status).toBe("active");
    expect(m.planId).toBe(planId);
    const [sub] = await serviceDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.merchantId, id));
    expect(sub).toMatchObject({ isTrial: true, trialUsed: true });
    const logs = await serviceDb.select().from(auditLogs).where(eq(auditLogs.merchantId, id));
    expect(logs.map((l) => [l.action, l.fromState, l.toState])).toContainEqual([
      "account.trial_started",
      "pending_payment",
      "active",
    ]);
  });

  it("refuses illegal transitions without writing anything", async () => {
    const id = await newMerchant("refuse");
    const r = await applyAccountEvent(
      id,
      { type: "cancel_requested", at: new Date() },
      { type: "user" },
    );
    expect(r).toMatchObject({ ok: false, error: "not_cancelable" });
    expect(
      await serviceDb.select().from(auditLogs).where(eq(auditLogs.merchantId, id)),
    ).toHaveLength(0);
  });

  it("drives the cron path: past_due after the period, suspended after grace", async () => {
    const id = await newMerchant("cron");
    const start = new Date("2026-01-01T10:00:00Z");
    await applyAccountEvent(
      id,
      { type: "payment_confirmed", at: start, planId, interval: { unit: "month", count: 1 } },
      { type: "system" },
    );
    await applyAccountEvent(
      id,
      { type: "period_check", at: new Date("2026-02-02T10:00:00Z") },
      { type: "system" },
    );
    expect((await merchantRow(id)).status).toBe("past_due");
    await applyAccountEvent(
      id,
      { type: "period_check", at: new Date("2026-02-07T10:00:00Z") },
      { type: "system" },
    );
    expect((await merchantRow(id)).status).toBe("suspended");
  });
});

describe("payments", () => {
  it("reuses the open invoice, settles once, and extends the period once", async () => {
    const id = await newMerchant("pay");
    const plan = (await getPlan(serviceDb, planId))!;
    const { invoice, again } = await serviceDb.transaction(async (tx) => ({
      invoice: await openInvoice(tx, id, plan),
      again: await openInvoice(tx, id, plan),
    }));
    expect(again.id).toBe(invoice.id);
    expect(invoice.number).toMatch(/^RN-\d{4}-\d{6}$/);
    const payment = await serviceDb.transaction((tx) =>
      createPayment(tx, { invoice, provider: "manual", status: "pending_review" }),
    );

    const first = await settlePayment(payment.id, { type: "admin", userId: users.at(-1) });
    expect(first).toMatchObject({ ok: true, alreadySettled: false });
    const afterFirst = await merchantRow(id);
    expect(afterFirst.status).toBe("active");

    const second = await settlePayment(payment.id, { type: "admin" });
    expect(second).toMatchObject({ ok: true, alreadySettled: true });
    expect((await merchantRow(id)).periodEnd?.getTime()).toBe(afterFirst.periodEnd?.getTime());

    const [inv] = await serviceDb.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(inv?.status).toBe("paid");
    expect(await failPayment(payment.id, "rejected", { type: "admin" })).toBe(false);
  });

  it("rejection leaves the account untouched", async () => {
    const id = await newMerchant("reject");
    const plan = (await getPlan(serviceDb, planId))!;
    const payment = await serviceDb.transaction(async (tx) =>
      createPayment(tx, {
        invoice: await openInvoice(tx, id, plan),
        provider: "manual",
        status: "pending_review",
      }),
    );
    expect(await failPayment(payment.id, "rejected", { type: "admin" }, "unreadable")).toBe(true);
    expect((await merchantRow(id)).status).toBe("pending_payment");
    const [p] = await serviceDb.select().from(payments).where(eq(payments.id, payment.id));
    expect(p).toMatchObject({ status: "rejected", reviewNote: "unreadable" });
  });
});

describe("webhook pipeline (mock provider)", () => {
  const secret = () => process.env.APP_SECRET!;

  async function pendingMockPayment() {
    const id = await newMerchant("hook");
    const plan = (await getPlan(serviceDb, planId))!;
    const payment = await serviceDb.transaction(async (tx) =>
      createPayment(tx, { invoice: await openInvoice(tx, id, plan), provider: "mock" }),
    );
    const providerRef = `mock_${payment.id}`;
    await serviceDb.update(payments).set({ providerRef }).where(eq(payments.id, payment.id));
    return { merchantId: id, paymentId: payment.id, providerRef };
  }

  function signed(body: object) {
    const raw = JSON.stringify(body);
    return {
      raw,
      headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(raw, secret()) }),
    };
  }

  it("activates on a verified success and ignores replays", async () => {
    const { merchantId, paymentId, providerRef } = await pendingMockPayment();
    const { raw, headers } = signed({
      id: `evt_${randomUUID()}`,
      type: "payment.succeeded",
      data: { providerRef, paymentId },
    });
    expect((await handleProviderWebhook("mock", raw, headers)).status).toBe(200);
    const first = await merchantRow(merchantId);
    expect(first.status).toBe("active");

    const replay = await handleProviderWebhook("mock", raw, headers);
    expect(replay).toEqual({ status: 200, body: { received: true, duplicate: true } });
    expect((await merchantRow(merchantId)).periodEnd?.getTime()).toBe(first.periodEnd?.getTime());
  });

  it("rejects bad signatures with 400 and changes nothing", async () => {
    const { merchantId, paymentId, providerRef } = await pendingMockPayment();
    const raw = JSON.stringify({
      id: `evt_${randomUUID()}`,
      type: "payment.succeeded",
      data: { providerRef, paymentId },
    });
    const r = await handleProviderWebhook(
      "mock",
      raw,
      new Headers({ [MOCK_SIGNATURE_HEADER]: "00".repeat(32) }),
    );
    expect(r.status).toBe(400);
    expect((await merchantRow(merchantId)).status).toBe("pending_payment");
  });

  it("marks failures without touching the account", async () => {
    const { merchantId, paymentId, providerRef } = await pendingMockPayment();
    const { raw, headers } = signed({
      id: `evt_${randomUUID()}`,
      type: "payment.failed",
      data: { providerRef, paymentId },
    });
    expect((await handleProviderWebhook("mock", raw, headers)).status).toBe(200);
    const [p] = await serviceDb
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId)));
    expect(p?.status).toBe("failed");
    expect((await merchantRow(merchantId)).status).toBe("pending_payment");
  });

  it("acknowledges unknown payments so the provider stops retrying", async () => {
    const paymentId = randomUUID();
    const { raw, headers } = signed({
      id: `evt_${randomUUID()}`,
      type: "payment.succeeded",
      data: { providerRef: `mock_${paymentId}`, paymentId },
    });
    expect(await handleProviderWebhook("mock", raw, headers)).toEqual({
      status: 200,
      body: { received: true, error: "unknown_payment" },
    });
  });

  it("answers 404 for providers that are not enabled", async () => {
    expect((await handleProviderWebhook("chargily", "{}", new Headers())).status).toBe(404);
  });
});
