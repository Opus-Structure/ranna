import "server-only";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { appUrl } from "@/config/brand";
import { localizedPath } from "@/lib/auth/paths";
import { serviceDb, withRls } from "@/lib/db/client";
import { merchants, notificationEvents, orders, pushSubscriptions } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env";
import { translatorFor } from "@/lib/i18n/translator";
import type { MerchantContext } from "@/lib/merchants/context";
import { messagingProvider, type MessagingProvider } from "@/lib/notify/messaging";
import { isAllowedPushEndpoint } from "@/lib/push/endpoints";
import { vapidSender, type PushSender } from "@/lib/push/sender";
import { checkLimit } from "@/lib/rate-limit";
import { supabaseBroadcast, type RealtimePublisher } from "@/lib/realtime/publish";
import { statusPayload } from "./service";
import { hashToken, orderTokenFor, orderTopic, TOKEN_PATTERN } from "./token";
import { isOpenOrder } from "./transitions";

/** A customer may register a few browsers (phone + Home Screen app), not an unbounded list. */
export const MAX_SUBSCRIPTIONS_PER_ORDER = 5;
/** Staff can ring again, but not turn a phone into a siren. */
export const MAX_RINGS = 6;
/** After this many consecutive failures a subscription is no longer tried. */
const MAX_PUSH_FAILURES = 3;

export type RingDeps = { sender?: PushSender; messaging?: MessagingProvider };

/* ---------------------------------------------------------------- subscribe */

const base64url = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+=*$/);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000),
  keys: z.object({ p256dh: base64url(80, 100), auth: base64url(16, 32) }),
});

export type SubscribeResult =
  { ok: true } | { ok: false; error: "invalid" | "not_found" | "closed" | "too_many" };

/** Registers a browser push subscription for one order. The token is the only credential. */
export async function subscribePush(token: string, raw: unknown): Promise<SubscribeResult> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, error: "not_found" };
  const parsed = pushSubscriptionSchema.safeParse(raw);
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint))
    return { ok: false, error: "invalid" };
  const { endpoint, keys } = parsed.data;
  return serviceDb.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, merchantId: orders.merchantId, status: orders.status })
      .from(orders)
      .where(eq(orders.tokenHash, hashToken(token)));
    if (!order) return { ok: false, error: "not_found" } as const;
    if (!isOpenOrder(order.status)) return { ok: false, error: "closed" } as const;
    const [existing] = await tx
      .select({ n: count() })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.orderId, order.id),
          sql`${pushSubscriptions.endpoint} <> ${endpoint}`,
        ),
      );
    if (Number(existing?.n ?? 0) >= MAX_SUBSCRIPTIONS_PER_ORDER)
      return { ok: false, error: "too_many" } as const;
    await tx
      .insert(pushSubscriptions)
      .values({
        orderId: order.id,
        merchantId: order.merchantId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.orderId, pushSubscriptions.endpoint],
        set: {
          p256dh: keys.p256dh,
          auth: keys.auth,
          status: "active",
          failureCount: 0,
          updatedAt: new Date(),
        },
      });
    return { ok: true } as const;
  });
}

/* --------------------------------------------------------------------- ring */

export type RingOutcome = {
  push: { sent: number; failed: number };
  fallback: "sent" | "skipped" | "failed" | null;
};

/**
 * Tells the customer their order is ready on every channel they have: web push to each
 * registered browser, then (only if no push got through) the SMS/WhatsApp fallback when the
 * shop enabled it and the customer left a phone number. Every attempt is recorded.
 * The open status page rings on its own through Realtime; this reaches closed or sleeping pages.
 */
export async function ringOrder(
  orderId: string,
  kind: "ready" | "rering",
  deps: RingDeps = {},
): Promise<RingOutcome> {
  const sender = deps.sender ?? vapidSender();
  const [o] = await serviceDb
    .select({
      merchantId: orders.merchantId,
      clientRequestId: orders.clientRequestId,
      number: orders.number,
      locale: orders.locale,
      phone: orders.customerPhone,
      shopName: merchants.name,
      settings: merchants.settings,
    })
    .from(orders)
    .innerJoin(merchants, eq(merchants.id, orders.merchantId))
    .where(eq(orders.id, orderId));
  if (!o) return { push: { sent: 0, failed: 0 }, fallback: null };

  const { t, locale } = translatorFor(o.locale);
  const token = orderTokenFor(serverEnv().APP_SECRET, o.merchantId, o.clientRequestId);
  const url = `${appUrl()}${localizedPath(`/o/${token}`, locale)}`;
  const message = {
    title: t("order.alerts.push.title", { number: o.number }),
    body: t("order.alerts.push.body", { shop: o.shopName }),
    url,
    tag: `order-${orderId}`,
  };

  const subs = await serviceDb
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.orderId, orderId), eq(pushSubscriptions.status, "active")));
  const results = await Promise.all(subs.map((s) => sender.send(s, message)));

  const now = new Date();
  let sent = 0;
  for (const [i, r] of results.entries()) {
    const s = subs[i]!;
    if (r.ok) sent++;
    const failures = r.ok ? 0 : s.failureCount + 1;
    await serviceDb
      .update(pushSubscriptions)
      .set(
        r.ok
          ? { lastSuccessAt: now, failureCount: 0, updatedAt: now }
          : {
              lastFailureAt: now,
              failureCount: failures,
              status: r.gone ? "expired" : failures >= MAX_PUSH_FAILURES ? "failed" : "active",
              updatedAt: now,
            },
      )
      .where(eq(pushSubscriptions.id, s.id));
  }
  const events: (typeof notificationEvents.$inferInsert)[] = results.map((r) => ({
    orderId,
    merchantId: o.merchantId,
    channel: "push",
    kind,
    status: r.ok ? "sent" : "failed",
    statusCode: r.statusCode,
    error: r.error ?? null,
  }));
  if (subs.length === 0) {
    events.push({
      orderId,
      merchantId: o.merchantId,
      channel: "push",
      kind,
      status: "skipped",
      statusCode: null,
      error: "no_subscription",
    });
  }

  let fallback: RingOutcome["fallback"] = null;
  if (sent === 0 && o.settings.fallbackMessaging && o.phone) {
    const messaging = deps.messaging ?? messagingProvider();
    const r = await messaging.send(o.phone, `${message.title}. ${message.body} ${url}`);
    // The mock sends nothing: it is recorded as skipped, never as delivered.
    fallback = !messaging.live ? "skipped" : r.ok ? "sent" : "failed";
    events.push({
      orderId,
      merchantId: o.merchantId,
      channel: messaging.channel,
      kind,
      status: fallback,
      statusCode: null,
      error: !messaging.live ? `provider_${messaging.name}` : (r.error ?? null),
    });
  }
  if (events.length) await serviceDb.insert(notificationEvents).values(events);
  return { push: { sent, failed: results.length - sent }, fallback };
}

/* ------------------------------------------------------------------ re-ring */

export type ReRingResult =
  | { ok: true; ringCount: number }
  | { ok: false; error: "not_found" | "not_ready" | "rate_limited" | "too_many" };

/** "Ring again" from the board: for ready orders only, at most once per 30 s and 6 times. */
export async function reRing(
  ctx: MerchantContext,
  orderId: string,
  publisher: RealtimePublisher = supabaseBroadcast,
  deps: RingDeps = {},
): Promise<ReRingResult> {
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "not_found" };
  // Read through RLS: only a member of the order's shop gets a row back.
  const [order] = await withRls(ctx.user.id, (tx) =>
    tx
      .select({
        status: orders.status,
        ringCount: orders.ringCount,
        tokenHash: orders.tokenHash,
        number: orders.number,
      })
      .from(orders)
      .where(eq(orders.id, orderId)),
  );
  if (!order) return { ok: false, error: "not_found" };
  if (order.status !== "ready") return { ok: false, error: "not_ready" };
  if (order.ringCount >= MAX_RINGS) return { ok: false, error: "too_many" };
  const limit = await checkLimit("reRing", `order:${orderId}`);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const now = new Date();
  const [updated] = await serviceDb
    .update(orders)
    .set({
      ringCount: sql`${orders.ringCount} + 1`,
      lastRungAt: now,
      acknowledgedAt: null,
      updatedAt: now,
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "ready")))
    .returning({ ringCount: orders.ringCount });
  if (!updated) return { ok: false, error: "not_ready" };
  // The open page restarts its alarm on "ring"; closed pages get a push.
  await publisher.publish(orderTopic(order.tokenHash), "ring", {
    number: order.number,
    at: now.toISOString(),
  });
  await ringOrder(orderId, "rering", deps);
  return { ok: true, ringCount: updated.ringCount };
}

/* ------------------------------------------------------------- acknowledge */

export type AckResult = { ok: true } | { ok: false; error: "not_found" | "not_ready" };

/**
 * "Got it, I'm coming": stops the alarm everywhere (other tabs, the Home Screen app) and shows
 * staff the customer is on the way. Idempotent.
 */
export async function acknowledgeOrder(
  token: string,
  publisher: RealtimePublisher = supabaseBroadcast,
): Promise<AckResult> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, error: "not_found" };
  const tokenHash = hashToken(token);
  const now = new Date();
  const [updated] = await serviceDb
    .update(orders)
    .set({ acknowledgedAt: now, updatedAt: now })
    .where(
      and(
        eq(orders.tokenHash, tokenHash),
        eq(orders.status, "ready"),
        isNull(orders.acknowledgedAt),
      ),
    )
    .returning({
      number: orders.number,
      status: orders.status,
      readyAt: orders.readyAt,
      acknowledgedAt: orders.acknowledgedAt,
      cancelReason: orders.cancelReason,
    });
  if (updated) {
    await publisher.publish(orderTopic(tokenHash), "status", statusPayload(updated));
    return { ok: true };
  }
  const [o] = await serviceDb
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.tokenHash, tokenHash));
  if (!o) return { ok: false, error: "not_found" };
  return o.status === "ready" ? { ok: true } : { ok: false, error: "not_ready" };
}
