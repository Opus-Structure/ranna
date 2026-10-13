import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { PendingSection } from "@/components/console/pending-section";
import { requireOwner } from "@/lib/auth/guards";
import { initLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.nav");
  return { title: t("shop") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  await requireOwner(locale);
  const t = await getTranslations("console.nav");
  return (
    <>
      <PageHeader title={t("shop")} />
      <PendingSection />
    </>
  );
}
