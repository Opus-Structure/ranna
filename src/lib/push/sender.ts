import "server-only";
import webpush from "web-push";
import { serverEnv } from "@/lib/env";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Same tag = replaces the previous notification for this order instead of stacking. */
  tag: string;
};
export type PushResult = { ok: boolean; statusCode: number | null; gone: boolean; error?: string };

/** Sends one Web Push message. Swappable in tests. Never logs endpoints or keys. */
export interface PushSender {
  readonly configured: boolean;
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}

export function vapidSender(): PushSender {
  const env = serverEnv();
  const configured = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  return {
    configured,
    async send(target, message) {
      if (!configured) return { ok: false, statusCode: null, gone: false, error: "not_configured" };
      try {
        const res = await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          {
            vapidDetails: {
              subject: env.VAPID_SUBJECT,
              publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              privateKey: env.VAPID_PRIVATE_KEY,
            },
            // A "ready" ring is useless an hour later; high urgency wakes sleeping phones.
            TTL: 15 * 60,
            urgency: "high",
            topic: message.tag.slice(0, 32),
            timeout: 8000,
          },
        );
        return { ok: true, statusCode: res.statusCode, gone: false };
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? null;
        return {
          ok: false,
          statusCode,
          // 404/410: the browser dropped the subscription for good.
          gone: statusCode === 404 || statusCode === 410,
          error: statusCode ? `http_${statusCode}` : "network",
        };
      }
    },
  };
}
