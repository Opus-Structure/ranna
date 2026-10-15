import "server-only";
import { and, eq } from "drizzle-orm";
import { serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants, orders } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { setOrderStatus } from "./service";
import { hashToken, TOKEN_PATTERN } from "./token";

/** Seconds after placing when a demo order moves on by itself. */
export const DEMO_PREPARING_AFTER_S = 1;
export const DEMO_READY_AFTER_S = 4;
/** Older demo orders (the seeded board) are left alone. */
const DEMO_WINDOW_S = 10 * 60;

/**
 * The demo café has no staff, so a visitor who orders there would never be rung. Its orders
 * advance on their own, triggered by the customer's own status polling (no background timers on
 * serverless): Preparing after 1 s, Ready after 4 s, through the real status service, so the
 * visitor gets the real ring. Only the shop flagged `is_demo` is ever touched.
 */
export async function advanceDemoOrder(token: string, now = new Date()): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  const [o] = await serviceDb
    .select({
      id: orders.id,
      status: orders.status,
      placedAt: orders.placedAt,
      merchantId: orders.merchantId,
    })
    .from(orders)
    .innerJoin(merchants, eq(merchants.id, orders.merchantId))
    .where(and(eq(orders.tokenHash, hashToken(token)), eq(merchants.isDemo, true)));
  if (!o) return;
  const age = (now.getTime() - o.placedAt.getTime()) / 1000;
  if (age > DEMO_WINDOW_S) return;
  const next =
    (o.status === "new" || o.status === "accepted") && age >= DEMO_PREPARING_AFTER_S
      ? age >= DEMO_READY_AFTER_S
        ? "ready"
        : "preparing"
      : o.status === "preparing" && age >= DEMO_READY_AFTER_S
        ? "ready"
        : null;
  if (!next) return;
  const [owner] = await serviceDb
    .select({ userId: merchantMembers.userId })
    .from(merchantMembers)
    .where(and(eq(merchantMembers.merchantId, o.merchantId), eq(merchantMembers.role, "owner")))
    .limit(1);
  if (!owner) return;
  // Acting as the demo shop's owner keeps the RLS-checked path; a lost race is harmless.
  await setOrderStatus({ user: { id: owner.userId } } as MerchantContext, o.id, next);
}
