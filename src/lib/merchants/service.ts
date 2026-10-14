import "server-only";
import { eq, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit/log";
import { serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants } from "@/lib/db/schema";
import type { AppLocale } from "@/i18n/routing";

/** Algerian shops usually serve Arabic and French; the signup language leads. */
export function defaultLocalesFor(locale: AppLocale): AppLocale[] {
  return Array.from(new Set<AppLocale>([locale, "ar", "fr"]));
}

/**
 * Creates the merchant (state `pending_payment`) and its owner membership.
 * Idempotent, including under concurrency: the console layout and page render in parallel on
 * the first visit, so both may try to create the shop. A per-user advisory lock serialises
 * them; the second caller waits, then finds and returns the first caller's shop.
 */
export async function createMerchantForOwner(input: {
  userId: string;
  name: string;
  locale: AppLocale;
}): Promise<{ merchantId: string; created: boolean }> {
  return serviceDb.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`merchant-create:${input.userId}`}, 0))`,
    );
    const [existing] = await tx
      .select({ merchantId: merchantMembers.merchantId })
      .from(merchantMembers)
      .where(eq(merchantMembers.userId, input.userId))
      .limit(1);
    if (existing) return { merchantId: existing.merchantId, created: false };

    const [m] = await tx
      .insert(merchants)
      .values({
        name: input.name,
        status: "pending_payment",
        defaultLocale: input.locale,
        locales: defaultLocalesFor(input.locale),
      })
      .returning({ id: merchants.id });
    const merchantId = m!.id;
    await tx.insert(merchantMembers).values({ merchantId, userId: input.userId, role: "owner" });
    await writeAudit(tx, {
      merchantId,
      actorUserId: input.userId,
      actorType: "user",
      action: "merchant.created",
      toState: "pending_payment",
    });
    return { merchantId, created: true };
  });
}
