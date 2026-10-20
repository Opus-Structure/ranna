/** The ring: push subscriptions, sending and recording, fallback, re-ring and acknowledgement. */
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb } from "@/lib/db/client";
import { merchants, notificationEvents, orders, pushSubscriptions } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import type { MessagingProvider } from "@/lib/notify/messaging";
import type { PushMessage, PushResult, PushSender, PushTarget } from "@/lib/push/sender";
import { acknowledgeOrder, MAX_RINGS, reRing, ringOrder, subscribePush } from "@/lib/orders/ring";
import { setOrderStatus } from "@/lib/orders/service";
import { hashToken, orderTopic } from "@/lib/orders/token";
import type { RealtimePublisher } from "@/lib/realtime/publish";
import { createTenant, deleteAuthUsers, ensureTestPlan, type Tenant } from "./fixtures";

const users: string[] = [];
const merchantIds: string[] = [];
let a: Tenant;
let b: Tenant;
const TOKEN = "RingTest_Token-0123456"; // 22 chars, base64url
const keys = { p256dh: `B${"x".repeat(86)}`, auth: "abcdefghijklmnopqrstuv" };
const sub = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/test-${n}`, keys });

function fakeSender(outcome: (t: PushTarget) => PushResult) {
  const sent: { target: PushTarget; message: PushMessage }[] = [];
  const sender: PushSender = {
    configured: true,
    async send(target, message) {
      sent.push({ target, message });
      return outcome(target);
    },
  };
  return { sender, sent };
}

function recorder() {
  const events: { topic: string; event: string; payload: Record<string, unknown> }[] = [];
  const publisher: RealtimePublisher = {
    publish: async (topic, event, payload) => void events.push({ topic, event, payload }),
  };
  return { publisher, events };
}

const ctxFor = (t: Tenant): MerchantContext =>
  ({
    user: { id: t.ownerId, email: null, emailVerified: true },
    role: "owner",
    merchant: { id: t.merchantId },
  }) as MerchantContext;

const events = (orderId: string) =>
  serviceDb.select().from(notificationEvents).where(eq(notificationEvents.orderId, orderId));

beforeAll(async () => {
  const planId = await ensureTestPlan();
  a = await createTenant("ring-a", planId);
  b = await createTenant("ring-b", planId);
  users.push(a.ownerId, b.ownerId);
  merchantIds.push(a.merchantId, b.merchantId);
  await serviceDb
    .update(orders)
    .set({ tokenHash: hashToken(TOKEN) })
    .where(eq(orders.id, a.orderId));
  // The shared fixture adds a placeholder subscription (for isolation tests); start clean here.
  for (const t of [a, b])
    await serviceDb.delete(pushSubscriptions).where(eq(pushSubscriptions.orderId, t.orderId));
});

afterAll(async () => {
  for (const id of merchantIds) await serviceDb.delete(merchants).where(eq(merchants.id, id));
  await deleteAuthUsers(users);
  await closeDb();
});

describe("subscribePush", () => {
  it("stores a valid subscription once per endpoint and refuses foreign endpoints", async () => {
    expect(await subscribePush(TOKEN, sub(1))).toEqual({ ok: true });
    expect(await subscribePush(TOKEN, sub(1))).toEqual({ ok: true }); // upsert, not duplicate
    expect(
      await subscribePush(TOKEN, { ...sub(9), endpoint: "https://169.254.169.254/x" }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      await subscribePush(TOKEN, {
        endpoint: sub(2).endpoint,
        keys: { p256dh: "short", auth: "x" },
      }),
    ).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await subscribePush("A".repeat(22), sub(3))).toEqual({ ok: false, error: "not_found" });
    const rows = await serviceDb
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.orderId, a.orderId));
    expect(rows).toHaveLength(1);
  });

  it("caps subscriptions per order", async () => {
    for (let n = 2; n <= 5; n++) expect(await subscribePush(TOKEN, sub(n))).toEqual({ ok: true });
    expect(await subscribePush(TOKEN, sub(6))).toEqual({ ok: false, error: "too_many" });
  });
});

describe("ringOrder", () => {
  it("pushes to every active subscription, retires gone ones and records each attempt", async () => {
    const { sender, sent } = fakeSender((t) =>
      t.endpoint.endsWith("test-2")
        ? { ok: false, statusCode: 410, gone: true, error: "http_410" }
        : { ok: true, statusCode: 201, gone: false },
    );
    const outcome = await ringOrder(a.orderId, "ready", { sender });
    expect(outcome).toEqual({ push: { sent: 4, failed: 1 }, fallback: null });
    // The fixture order's locale is the default (ar); the link carries the token.
    expect(sent[0]!.message.url).toContain(`/o/`);
    expect(sent[0]!.message.tag).toBe(`order-${a.orderId}`);
    const gone = await serviceDb
      .select({ status: pushSubscriptions.status })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.orderId, a.orderId),
          eq(pushSubscriptions.endpoint, sub(2).endpoint),
        ),
      );
    expect(gone[0]?.status).toBe("expired");
    const recorded = await events(a.orderId);
    expect(recorded.filter((e) => e.channel === "push" && e.status === "sent")).toHaveLength(4);
    expect(recorded.filter((e) => e.status === "failed" && e.statusCode === 410)).toHaveLength(1);
  });

  it("falls back to messaging only when no push got through, and never calls the mock delivered", async () => {
    await serviceDb
      .update(merchants)
      .set({ settings: { fallbackMessaging: true } })
      .where(eq(merchants.id, b.merchantId));
    const texts: string[] = [];
    const live: MessagingProvider = {
      name: "test",
      channel: "sms",
      live: true,
      send: async (_to, text) => (texts.push(text), { ok: true }),
    };
    const mock: MessagingProvider = { ...live, name: "mock", live: false };
    const { sender } = fakeSender(() => ({ ok: false, statusCode: null, gone: false }));

    expect(await ringOrder(b.orderId, "ready", { sender, messaging: live })).toEqual({
      push: { sent: 0, failed: 0 },
      fallback: "sent",
    });
    expect(texts[0]).toMatch(/101/);
    expect(await ringOrder(b.orderId, "rering", { sender, messaging: mock })).toMatchObject({
      fallback: "skipped",
    });
    const recorded = await events(b.orderId);
    expect(recorded.find((e) => e.channel === "sms" && e.kind === "rering")).toMatchObject({
      status: "skipped",
      error: "provider_mock",
    });
    expect(recorded.find((e) => e.channel === "push" && e.kind === "ready")).toMatchObject({
      status: "skipped",
      error: "no_subscription",
    });
  });
});

describe("ready, re-ring and acknowledgement", () => {
  it("marking ready clears an earlier acknowledgement and rings", async () => {
    await serviceDb
      .update(orders)
      .set({ status: "preparing", acknowledgedAt: new Date() })
      .where(eq(orders.id, a.orderId));
    const { publisher, events: sentEvents } = recorder();
    const rung: string[] = [];
    const result = await setOrderStatus(
      ctxFor(a),
      a.orderId,
      "ready",
      {},
      publisher,
      async (id) => void rung.push(id),
    );
    expect(result).toEqual({ ok: true, status: "ready" });
    expect(rung).toEqual([a.orderId]);
    expect(sentEvents[0]).toMatchObject({
      topic: orderTopic(hashToken(TOKEN)),
      payload: { stage: "ready", acknowledgedAt: null },
    });
    const [row] = await serviceDb.select().from(orders).where(eq(orders.id, a.orderId));
    expect(row).toMatchObject({ acknowledgedAt: null, ringCount: 1 });
  });

  it("acknowledges once, idempotently, and only ready orders", async () => {
    const { publisher, events: sentEvents } = recorder();
    expect(await acknowledgeOrder(TOKEN, publisher)).toEqual({ ok: true });
    expect(sentEvents[0]?.payload.acknowledgedAt).toEqual(expect.any(String));
    expect(await acknowledgeOrder(TOKEN, publisher)).toEqual({ ok: true });
    expect(sentEvents).toHaveLength(1);
    expect(await acknowledgeOrder("A".repeat(22), publisher)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("re-rings ready orders of the member's own shop, rate-limited and capped", async () => {
    const { sender } = fakeSender(() => ({ ok: true, statusCode: 201, gone: false }));
    const { publisher, events: sentEvents } = recorder();
    // Another shop's owner gets nothing back through RLS.
    expect(await reRing(ctxFor(b), a.orderId, publisher, { sender })).toEqual({
      ok: false,
      error: "not_found",
    });
    const first = await reRing(ctxFor(a), a.orderId, publisher, { sender });
    expect(first).toEqual({ ok: true, ringCount: 2 });
    expect(sentEvents.at(-1)).toMatchObject({ event: "ring", payload: { number: 101 } });
    const [row] = await serviceDb.select().from(orders).where(eq(orders.id, a.orderId));
    expect(row?.acknowledgedAt).toBeNull(); // ringing again re-arms the customer's alarm
    expect(await reRing(ctxFor(a), a.orderId, publisher, { sender })).toEqual({
      ok: false,
      error: "rate_limited",
    });
    await serviceDb.update(orders).set({ ringCount: MAX_RINGS }).where(eq(orders.id, a.orderId));
    expect(await reRing(ctxFor(a), a.orderId, publisher, { sender })).toEqual({
      ok: false,
      error: "too_many",
    });
    await serviceDb.update(orders).set({ status: "completed" }).where(eq(orders.id, a.orderId));
    expect(await reRing(ctxFor(a), a.orderId, publisher, { sender })).toEqual({
      ok: false,
      error: "not_ready",
    });
    expect(await subscribePush(TOKEN, sub(7))).toEqual({ ok: false, error: "closed" });
  });
});
