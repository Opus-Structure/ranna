import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditGate } from "@/components/console/edit-gate";
import { PageHeader } from "@/components/console/page-header";
import { MenuEditor } from "@/components/menu-editor/menu-editor";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { withRls } from "@/lib/db/client";
import { merchants } from "@/lib/db/schema";
import { itemUsage, loadMenu } from "@/lib/menu/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("menu");
  return { title: t("title") };
}

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  const t = await getTranslations("menu");
  const [menu, usage, [shop]] = await Promise.all([
    loadMenu(ctx.user.id, ctx.merchant.id),
    itemUsage(ctx),
    withRls(ctx.user.id, (tx) =>
      tx
        .select({ locales: merchants.locales, defaultLocale: merchants.defaultLocale })
        .from(merchants)
        .where(eq(merchants.id, ctx.merchant.id)),
    ),
  ]);
  const shopLocales = (shop?.locales ?? ["ar"]).filter(isAppLocale);
  const defaultLocale: AppLocale = isAppLocale(shop?.defaultLocale) ? shop.defaultLocale : "ar";

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <EditGate ctx={ctx}>
        <MenuEditor
          initial={menu}
          currency={ctx.merchant.currency}
          locales={shopLocales}
          defaultLocale={defaultLocale}
          usage={usage}
          readOnly={!merchantAccess(ctx.merchant).canEdit}
        />
      </EditGate>
    </>
  );
}
