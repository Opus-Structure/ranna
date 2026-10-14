import "server-only";
import { lt, sql } from "drizzle-orm";
import { serviceDb } from "@/lib/db/client";
import { rateLimitBuckets } from "@/lib/db/schema";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export interface RateLimiter {
  consume(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
}

/** Pure window maths, shared by every implementation (and unit-tested). */
export function windowFor(nowMs: number, windowSec: number) {
  const size = windowSec * 1000;
  const start = Math.floor(nowMs / size) * size;
  return {
    start: new Date(start),
    retryAfterSec: Math.max(1, Math.ceil((start + size - nowMs) / 1000)),
  };
}

/** Fixed-window counters in Postgres (D13): one atomic upsert per check, no extra infra. */
export const postgresRateLimiter: RateLimiter = {
  async consume(key, limit, windowSec) {
    const { start, retryAfterSec } = windowFor(Date.now(), windowSec);
    const [row] = await serviceDb
      .insert(rateLimitBuckets)
      .values({ key, windowStart: start, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
        set: { count: sql`${rateLimitBuckets.count} + 1` },
      })
      .returning({ count: rateLimitBuckets.count });
    const count = row?.count ?? limit + 1;
    return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec };
  },
};

/** Named limits, so every caller uses the same numbers. */
export const limits = {
  signup: { limit: 5, windowSec: 60 * 60 },
  login: { limit: 10, windowSec: 15 * 60 },
  magicLink: { limit: 5, windowSec: 15 * 60 },
  placeOrder: { limit: 8, windowSec: 10 * 60 },
  reRing: { limit: 1, windowSec: 30 },
  pushSubscribe: { limit: 10, windowSec: 10 * 60 },
  receiptUpload: { limit: 10, windowSec: 60 * 60 },
  staffInvite: { limit: 20, windowSec: 60 * 60 },
} as const;

export type LimitName = keyof typeof limits;

export async function checkLimit(
  name: LimitName,
  identity: string,
  limiter: RateLimiter = postgresRateLimiter,
): Promise<RateLimitResult> {
  const { limit, windowSec } = limits[name];
  return limiter.consume(`${name}:${identity}`, limit, windowSec);
}

/** Housekeeping for the daily cron. */
export async function purgeOldBuckets(olderThan: Date): Promise<number> {
  const rows = await serviceDb
    .delete(rateLimitBuckets)
    .where(lt(rateLimitBuckets.windowStart, olderThan))
    .returning({ key: rateLimitBuckets.key });
  return rows.length;
}
