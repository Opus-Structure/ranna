import { getTranslations } from "next-intl/server";
import { PlanEditor } from "@/components/admin/plan-editor";
import { PageHeader } from "@/components/console/page-header";
import { initLocale } from "@/i18n/server";
import { listPlans } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { currencyExponent, toMajor } from "@/lib/money";

export default async function AdminPlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const user = await requireAdmin(locale);
  const t = await getTranslations("admin.plans");
  const rows = await listPlans(user.id);
  return (
    <>
      <PageHeader title={t("title")} description={t("help")} />
      <div className="flex max-w-4xl flex-col gap-4">
        {rows.map((p) => (
          <PlanEditor
            key={p.id}
            plan={{
              id: p.id,
              name: p.nameI18n[locale] ?? p.name,
              price: toMajor(p.priceMinor, p.currency),
              exponent: currencyExponent(p.currency),
              currency: p.currency,
              trialDays: p.trialDays,
              maxItems: p.limits.maxItems,
              maxStaff: p.limits.maxStaff,
              maxMonthlyOrders: p.limits.maxMonthlyOrders,
              maxTables: p.limits.maxTables ?? null,
              isActive: p.isActive,
            }}
          />
        ))}
      </div>
    </>
  );
}
