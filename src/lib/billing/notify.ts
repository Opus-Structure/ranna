import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { appUrl, brandName } from "@/config/brand";
import { localizedPath } from "@/lib/auth/paths";
import { serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants, profiles } from "@/lib/db/schema";
import { translatorFor } from "@/lib/i18n/translator";
import { sendSafely } from "@/lib/mail/mailer";
import type { AccountEffect } from "./state-machine";

type Owner = { email: string; locale: string; shopName: string };

async function findOwner(merchantId: string): Promise<Owner | null> {
  const [row] = await serviceDb
    .select({
      shopName: merchants.name,
      merchantLocale: merchants.defaultLocale,
      profileLocale: profiles.locale,
      email: sql<string>`(select email from auth.users u where u.id = ${merchantMembers.userId})`,
    })
    .from(merchantMembers)
    .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
    .leftJoin(profiles, eq(profiles.id, merchantMembers.userId))
    .where(and(eq(merchantMembers.merchantId, merchantId), eq(merchantMembers.role, "owner")))
    .limit(1);
  if (!row?.email) return null;
  return {
    email: row.email,
    locale: row.profileLocale ?? row.merchantLocale,
    shopName: row.shopName,
  };
}

/** Emails the owner about account changes. Best effort: never throws. */
export async function dispatchAccountEffects(
  merchantId: string,
  effects: AccountEffect[],
): Promise<void> {
  if (effects.length === 0) return;
  const owner = await findOwner(merchantId).catch(() => null);
  if (!owner) return;
  const { t, locale } = translatorFor(owner.locale);
  const billingUrl = `${appUrl()}${localizedPath("/dashboard/billing", locale)}`;
  for (const effect of effects) {
    await sendSafely({
      to: owner.email,
      subject: t(`emails.account.${effect}.subject`, {
        shop: owner.shopName,
        brand: brandName(locale),
      }),
      text: `${t(`emails.account.${effect}.body`, { shop: owner.shopName })}\n\n${billingUrl}\n\n— ${brandName(locale)}`,
    });
  }
}

/** Tells the owner a manual payment was approved (the activation email follows) or rejected. */
export async function notifyPaymentRejected(
  merchantId: string,
  note: string | null,
): Promise<void> {
  const owner = await findOwner(merchantId).catch(() => null);
  if (!owner) return;
  const { t, locale } = translatorFor(owner.locale);
  const billingUrl = `${appUrl()}${localizedPath("/dashboard/billing", locale)}`;
  await sendSafely({
    to: owner.email,
    subject: t("emails.paymentRejected.subject", { brand: brandName(locale) }),
    text: [
      t("emails.paymentRejected.body", { shop: owner.shopName }),
      note ? `\n“${note}”` : "",
      `\n\n${billingUrl}`,
    ].join(""),
  });
}
