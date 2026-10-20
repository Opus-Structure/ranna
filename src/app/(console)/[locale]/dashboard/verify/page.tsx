import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VerifyForm } from "@/components/billing/verify-form";
import { PageHeader } from "@/components/console/page-header";
import { redirect } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";
import { requireMerchant } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.verify");
  return { title: t("title") };
}

/** Step one for a new owner: the commercial register, then the 15-day trial starts. */
export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireMerchant(locale);
  if (ctx.role !== "owner" || ctx.merchant.registerSubmittedAt || ctx.merchant.isDemo)
    redirect({ href: "/dashboard", locale });
  const t = await getTranslations("console.verify");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <VerifyForm />
    </>
  );
}
