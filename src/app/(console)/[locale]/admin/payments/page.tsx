import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { PendingSection } from "@/components/console/pending-section";
import { requireAdmin } from "@/lib/auth/guards";
import { initLocale } from "@/i18n/server";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  await requireAdmin(locale);
  const t = await getTranslations("admin.nav");
  return (
    <>
      <PageHeader title={t("payments")} />
      <PendingSection />
    </>
  );
}
