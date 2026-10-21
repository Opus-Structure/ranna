import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { getProfile, getSessionUser, type SessionUser } from "@/lib/auth/session";
import { withRls } from "@/lib/db/client";
import { merchantMembers, merchants } from "@/lib/db/schema";

export type MemberRole = "owner" | "staff";
export type StaffAccess = "orders" | "kitchen";

export type ConsoleMerchant = {
  id: string;
  name: string;
  slug: string | null;
  status: "pending_payment" | "active" | "past_due" | "suspended" | "canceled";
  periodEnd: Date | null;
  graceUntil: Date | null;
  isOpen: boolean;
  acceptingOrders: boolean;
  currency: string;
  timezone: string;
  defaultLocale: string;
  setupCompletedAt: Date | null;
  /** Null until the owner submits the commercial register (required before the free trial). */
  registerSubmittedAt: Date | null;
  isDemo: boolean;
  /** Platform admins run the platform: no business verification, no billing lock. */
  billingExempt: boolean;
};

export type MerchantContext = {
  user: SessionUser;
  merchant: ConsoleMerchant;
  role: MemberRole;
  /** Which screen a staff member may open; owners always have both. */
  access: StaffAccess;
};

/**
 * The signed-in user's shop, read through RLS. A user with several memberships gets their
 * owned shop first (D17: multi-branch switching plugs in here).
 */
export const getMerchantContext = cache(async (): Promise<MerchantContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  return loadMerchantContext(user);
});

/** Uncached variant, for re-reading right after the merchant was created in the same request. */
export async function loadMerchantContext(user: SessionUser): Promise<MerchantContext | null> {
  const [row] = await withRls(user.id, (tx) =>
    tx
      .select({
        role: merchantMembers.role,
        access: merchantMembers.access,
        merchant: {
          id: merchants.id,
          name: merchants.name,
          slug: merchants.slug,
          status: merchants.status,
          periodEnd: merchants.periodEnd,
          graceUntil: merchants.graceUntil,
          isOpen: merchants.isOpen,
          acceptingOrders: merchants.acceptingOrders,
          currency: merchants.currency,
          timezone: merchants.timezone,
          defaultLocale: merchants.defaultLocale,
          setupCompletedAt: merchants.setupCompletedAt,
          registerSubmittedAt: merchants.registerSubmittedAt,
          isDemo: merchants.isDemo,
        },
      })
      .from(merchantMembers)
      .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
      .where(eq(merchantMembers.userId, user.id))
      .orderBy(
        sql`case when ${merchantMembers.role} = 'owner' then 0 else 1 end`,
        asc(merchantMembers.createdAt),
      )
      .limit(1),
  );
  if (!row) return null;
  const billingExempt = Boolean((await getProfile(user.id))?.isPlatformAdmin);
  return { user, merchant: { ...row.merchant, billingExempt }, role: row.role, access: row.access };
}
