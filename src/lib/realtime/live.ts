import "server-only";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { serverEnv } from "@/lib/env";

/** Row shapes of the live queries (columns arrive snake_case, timestamps as Date). */
export type OrderPulse = {
  status: string;
  acknowledged_at: Date | null;
  last_rung_at: Date | null;
  ring_count: number;
};
export type BoardPulse = { id: string; status: string; updated_at: Date };

type Realtime = ReturnType<typeof createRealtime>;
let instance: Realtime | null | undefined;

/** Null when Realtime isn't configured: callers answer 503 and clients poll instead. */
function realtime(): Realtime | null {
  if (instance !== undefined) return instance;
  const env = serverEnv();
  if (!env.NEON_REALTIME_SECRET || !env.NEON_REALTIME_URL) return (instance = null);
  const db = decodeURIComponent(new URL(env.DATABASE_URL).pathname.replace(/^\//, "")) || "neondb";
  instance = createRealtime({
    secret: env.NEON_REALTIME_SECRET,
    db,
    // Full database errors in the subscription, development only (they can name tables and columns).
    debugMode: process.env.NODE_ENV === "development",
  });
  return instance;
}

/**
 * One customer's order, found by its token hash. The hash only reaches this function after the
 * caller proved they hold the token, and sealing bakes it into the capability, so the browser
 * can read exactly this row and nothing else (D5).
 */
export async function sealOrderPulse(tokenHash: string) {
  const rt = realtime();
  if (!rt) return null;
  return rt.seal({
    query: rawSql<OrderPulse>(
      `select status, acknowledged_at, last_rung_at, ring_count
         from public.orders where token_hash = $1`,
      [tokenHash],
    ),
  });
}

/**
 * The shop's most recently touched orders. The board only treats a change here as "something
 * moved" and re-reads through the server (D47), so it never trusts row data from the socket.
 */
export async function sealBoardPulse(merchantId: string) {
  const rt = realtime();
  if (!rt) return null;
  return rt.seal({
    query: rawSql<BoardPulse>(
      `select id, status, updated_at from public.orders
         where merchant_id = $1 order by updated_at desc, id limit 60`,
      [merchantId],
    ),
  });
}
