import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditGate } from "@/components/console/edit-gate";
import { PageHeader } from "@/components/console/page-header";
import { QrManager } from "@/components/qr/qr-manager";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { shopTheme } from "@/lib/branding/theme";
import { withRls } from "@/lib/db/client";
import { merchants } from "@/lib/db/schema";
import { translatorFor } from "@/lib/i18n/translator";
import { listTableQrs } from "@/lib/qr/service";
import { assetUrl } from "@/lib/storage/public-url";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("qr");
  return { title: t("title") };
}

export default async function QrPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  const t = await getTranslations("qr");
  const [m] = await withRls(ctx.user.id, (tx) =>
    tx
      .select({
        name: merchants.name,
        slug: merchants.slug,
        branding: merchants.branding,
        locales: merchants.locales,
        defaultLocale: merchants.defaultLocale,
      })
      .from(merchants)
      .where(eq(merchants.id, ctx.merchant.id)),
  );

  if (!m?.slug) {
    return (
      <>
        <PageHeader title={t("title")} />
        <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-dashed p-8">
          <span aria-hidden className="band-rule w-20 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">{t("noSlug.title")}</h2>
          <p className="text-muted-foreground">{t("noSlug.body")}</p>
          <Button asChild className="self-start">
            <Link href="/dashboard/shop">{t("noSlug.action")}</Link>
          </Button>
        </div>
      </>
    );
  }

  const theme = shopTheme(m.branding);
  // "Scan to order" in every language the shop speaks, main language first.
  const shopLocales = m.locales.filter(isAppLocale);
  const ordered: AppLocale[] = [
    ...(isAppLocale(m.defaultLocale) ? [m.defaultLocale] : []),
    ...shopLocales.filter((l) => l !== m.defaultLocale),
  ];
  const texts = ordered.map((l) => {
    const { t: tl } = translatorFor(l);
    return { locale: l, scan: tl("qr.print.scan"), noApp: tl("qr.print.noApp") };
  });
  const tables = await listTableQrs(ctx);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <EditGate ctx={ctx}>
        <QrManager
          origin={appUrl()}
          slug={m.slug}
          tables={tables}
          readOnly={!merchantAccess(ctx.merchant).canEdit}
          print={{
            shopName: m.name,
            logoUrl: assetUrl(m.branding.logoPath),
            primary: theme.vars["--brand"]!,
            primaryContrast: theme.vars["--brand-contrast"]!,
            ink: theme.vars["--brand-ink"]!,
            accent: theme.vars["--brand-2"]!,
            accentContrast: theme.vars["--brand-2-contrast"]!,
            font: theme.font,
            texts,
          }}
        />
      </EditGate>
    </>
  );
}
