import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { StaffManager } from "@/components/staff/staff-manager";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { loadStaff } from "@/lib/merchants/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staff");
  return { title: t("title") };
}

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  const t = await getTranslations("staff");
  const data = await loadStaff(ctx);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StaffManager
        data={data}
        selfId={ctx.user.id}
        readOnly={!merchantAccess(ctx.merchant).canEdit}
      />
    </>
  );
}
