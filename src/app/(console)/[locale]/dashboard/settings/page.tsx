import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditGate } from "@/components/console/edit-gate";
import { PageHeader } from "@/components/console/page-header";
import { SettingsForm } from "@/components/shop-editor/settings-form";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { withRls } from "@/lib/db/client";
import { merchants } from "@/lib/db/schema";
import { CURRENCIES, DEFAULT_SETTINGS, TIMEZONES } from "@/lib/validation/shop";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  const t = await getTranslations("settings");
  const [m] = await withRls(ctx.user.id, (tx) =>
    tx
      .select({
        settings: merchants.settings,
        currency: merchants.currency,
        timezone: merchants.timezone,
      })
      .from(merchants)
      .where(eq(merchants.id, ctx.merchant.id)),
  );
  const s = m?.settings ?? {};
  const currency = (CURRENCIES as readonly string[]).includes(m?.currency ?? "")
    ? (m!.currency as (typeof CURRENCIES)[number])
    : "DZD";
  const timezone = (TIMEZONES as readonly string[]).includes(m?.timezone ?? "")
    ? (m!.timezone as (typeof TIMEZONES)[number])
    : "Africa/Algiers";
  return (
    <>
      <PageHeader title={t("title")} />
      <EditGate ctx={ctx}>
        <SettingsForm
          readOnly={!merchantAccess(ctx.merchant).canEdit}
          initial={{
            prepTargetMinutes: s.prepTargetMinutes ?? DEFAULT_SETTINGS.prepTargetMinutes,
            askPhone: s.askPhone ?? DEFAULT_SETTINGS.askPhone,
            phoneRetentionDays: s.phoneRetentionDays ?? DEFAULT_SETTINGS.phoneRetentionDays,
            fallbackMessaging: s.fallbackMessaging ?? DEFAULT_SETTINGS.fallbackMessaging,
            currency,
            timezone,
          }}
        />
      </EditGate>
    </>
  );
}
