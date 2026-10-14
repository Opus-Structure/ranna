/** Daily jobs and the Chargily webhook path against the real database. */
// Before any import reads the environment: enable Chargily with a test key for this file.
process.env.PAYMENT_PROVIDERS = "chargily,mock,manual";
process.env.CHARGILY_SECRET_KEY = "test_sk_jobs_0123456789";
process.env.CHARGILY_MODE = "test";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPayment, openInvoice } from "@/lib/billing/payments";
import { CHARGILY_SIGNATURE_HEADER } from "@/lib/billing/providers/chargily";
import { hmacSha256Hex } from "@/lib/billing/providers/signature";
import { handleProviderWebhook } from "@/lib/billing/webhooks";
import { closeDb, serviceDb } from "@/lib/db/client";
import {
  auditLogs,
  merchants,
  orders,
  payments,
  plans,
  pushSubscriptions,
  subscriptions,
} from "@/lib/db/schema";
import {
  purgeCustomerPhones,
  purgePushSubscriptions,
  runDailyJobs,
  runPeriodChecks,
  sendPeriodReminders,
} from "@/lib/jobs/daily";
import { createTenant, deleteAuthUsers, type Tenant } from "./fixtures";

const DAY = 86_400_000;
const users: string[] = [];
const merchantIds: string[] = [];
let planId: string;

async function tenant(
  label: string,
  set: Partial<typeof merchants.$inferInsert> = {},
): Promise<Tenant> {
  const t = await createTenant(label, planId);
  users.push(t.ownerId);
  merchantIds.push(t.merchantId);
  if (Object.keys(set).length)
    await serviceDb.update(merchants).set(set).where(eq(merchants.id, t.merchantId));
  await serviceDb
    .insert(subscriptions)
    .values({
      merchantId: t.merchantId,
      planId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: set.periodEnd ?? null,
    })
    .onConflictDoNothing();
  return t;
}

const merchant = async (id: string) =>
  (await serviceDb.select().from(merchants).where(eq(merchants.id, id)))[0]!;

beforeAll(async () => {
  const [p] = await serviceDb
    .insert(plans)
    .values({
      code: `jobs-test-${randomUUID().slice(0, 8)}`,
      name: "Jobs test",
      priceMinor: 290000,
      currency: "DZD",
      limits: { maxItems: 10, maxStaff: 1, maxMonthlyOrders: null },
      isActive: false,
    })
    .returning();
  planId = p!.id;
});

afterAll(async () => {
  for (const id of merchantIds) await serviceDb.delete(merchants).where(eq(merchants.id, id));
  await serviceDb.delete(plans).where(eq(plans.id, planId));
  await deleteAuthUsers(users);
  await closeDb();
});

describe("Chargily webhook", () => {
  async function chargilyPayment(label: string) {
    const t = await tenant(label, { status: "pending_payment" });
    const [plan] = await serviceDb.select().from(plans).where(eq(plans.id, planId));
    const payment = await serviceDb.transaction(async (tx) => {
      const invoice = await openInvoice(tx, t.merchantId, plan!);
      return createPayment(tx, { invoice, provider: "chargily" });
    });
    const ref = `ch_${randomUUID().slice(0, 12)}`;
    await serviceDb.update(payments).set({ providerRef: ref }).where(eq(payments.id, payment.id));
    return { t, payment, ref };
  }
  const send = (body: object) => {
    const raw = JSON.stringify(body);
    return handleProviderWebhook(
      "chargily",
      raw,
      new Headers({
        [CHARGILY_SIGNATURE_HEADER]: hmacSha256Hex(process.env.CHARGILY_SECRET_KEY!, raw),
      }),
    );
  };
  const paid = (ref: string, paymentId: string, amount: number) => ({
    id: `evt_${randomUUID()}`,
    entity: "event",
    livemode: "false",
    type: "checkout.paid",
    data: { id: ref, status: "paid", amount, currency: "dzd", metadata: { payment_id: paymentId } },
  });

  it("refuses to activate a plan when the paid amount differs", async () => {
    const { t, payment, ref } = await chargilyPayment("ch-mismatch");
    expect(await send(paid(ref, payment.id, 1))).toEqual({
      status: 200,
      body: { received: true, error: "amount_mismatch" },
    });
    expect((await merchant(t.merchantId)).status).toBe("pending_payment");
    const [p] = await serviceDb.select().from(payments).where(eq(payments.id, payment.id));
    expect(p?.status).toBe("pending");
  });

  it("activates the plan for a correctly paid checkout, once", async () => {
    const { t, payment, ref } = await chargilyPayment("ch-paid");
    const event = paid(ref, payment.id, 2900);
    expect(await send(event)).toEqual({ status: 200, body: { received: true } });
    expect((await merchant(t.merchantId)).status).toBe("active");
    expect(await send(event)).toEqual({ status: 200, body: { received: true, duplicate: true } });
  });

  it("rejects an unsigned call", async () => {
    const result = await handleProviderWebhook(
      "chargily",
      JSON.stringify(paid("x", randomUUID(), 1)),
      new Headers(),
    );
    expect(result.status).toBe(400);
  });
});

describe("daily jobs", () => {
  it("moves ended periods to past due, then suspends after grace, and is idempotent", async () => {
    const now = new Date();
    const ended = await tenant("job-ended", {
      status: "active",
      periodEnd: new Date(now.getTime() - DAY),
    });
    const graceOver = await tenant("job-grace", {
      status: "past_due",
      periodEnd: new Date(now.getTime() - 10 * DAY),
      graceUntil: new Date(now.getTime() - DAY),
    });
    const fine = await tenant("job-fine", {
      status: "active",
      periodEnd: new Date(now.getTime() + 20 * DAY),
    });
    const first = await runPeriodChecks(now);
    expect(first.changed).toBeGreaterThanOrEqual(2);
    expect((await merchant(ended.merchantId)).status).toBe("past_due");
    expect((await merchant(ended.merchantId)).graceUntil).toBeInstanceOf(Date);
    expect((await merchant(graceOver.merchantId)).status).toBe("suspended");
    expect((await merchant(fine.merchantId)).status).toBe("active");
    const again = await runPeriodChecks(now);
    expect(again.changed).toBe(0);
  });

  it("reminds an owner once per period, a few days before it ends", async () => {
    const now = new Date();
    const soon = await tenant("job-remind", {
      status: "active",
      periodEnd: new Date(now.getTime() + 2 * DAY),
    });
    await tenant("job-later", { status: "active", periodEnd: new Date(now.getTime() + 15 * DAY) });
    expect(await sendPeriodReminders(now)).toBeGreaterThanOrEqual(1);
    const logged = await serviceDb
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.merchantId, soon.merchantId),
          eq(auditLogs.action, "billing.reminder_sent"),
        ),
      );
    expect(logged).toHaveLength(1);
    await sendPeriodReminders(now);
    const again = await serviceDb
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.merchantId, soon.merchantId),
          eq(auditLogs.action, "billing.reminder_sent"),
        ),
      );
    expect(again).toHaveLength(1);
  });

  it("erases customer phones after each shop's retention period", async () => {
    const now = new Date();
    const strict = await tenant("job-phones", { settings: { phoneRetentionDays: 3 } });
    const lax = await tenant("job-phones-lax", {});
    // Both fixture orders have a phone; age them to 5 days.
    for (const t of [strict, lax]) {
      await serviceDb
        .update(orders)
        .set({ placedAt: new Date(now.getTime() - 5 * DAY) })
        .where(eq(orders.id, t.orderId));
    }
    await purgeCustomerPhones(now);
    const [s] = await serviceDb.select().from(orders).where(eq(orders.id, strict.orderId));
    const [l] = await serviceDb.select().from(orders).where(eq(orders.id, lax.orderId));
    expect(s).toMatchObject({ customerPhone: null });
    expect(s?.phonePurgedAt).toBeInstanceOf(Date);
    expect(l?.customerPhone).toBe("0555000000"); // default 30 days not reached
  });

  it("drops push subscriptions of closed orders", async () => {
    const now = new Date();
    const t = await tenant("job-push");
    await serviceDb
      .update(orders)
      .set({ status: "completed", completedAt: new Date(now.getTime() - 2 * DAY) })
      .where(eq(orders.id, t.orderId));
    expect(await purgePushSubscriptions(now)).toBeGreaterThanOrEqual(1);
    const left = await serviceDb
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.orderId, t.orderId));
    expect(left).toHaveLength(0);
  });

  it("runs every task and reports without errors", async () => {
    const report = await runDailyJobs();
    expect(report.errors).toEqual([]);
  });
});
