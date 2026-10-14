import { getTranslations } from "next-intl/server";
import { MerchantStatusBadge } from "@/components/console/merchant-status-badge";
import { PageHeader } from "@/components/console/page-header";
import { initLocale } from "@/i18n/server";
import { merchantStatuses, platformMetrics } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";

/** A plain ledger of platform numbers, read through the admin RLS policies. */
export default async function AdminMetricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await initLocale(params);
  const user = await requireAdmin(locale);
  const t = await getTranslations("admin.metrics");
  const m = await platformMetrics(user.id);
  const total = Object.values(m.byState).reduce<number>((s, n) => s + (n ?? 0), 0);

  const rows: [string, string][] = [
    [t("mrr"), formatMoney(m.mrrMinor, m.currency, locale)],
    [t("orders30"), String(m.orders30)],
    [t("pendingReview"), String(m.pendingReview)],
    [t("trials"), String(m.trials)],
  ];

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid max-w-5xl gap-10 lg:grid-cols-[1.2fr_1fr]">
        <dl className="divide-y rounded-xl border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-6 px-5 py-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-display text-2xl font-bold" data-numeric>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="by-state">
          <h2 id="by-state" className="mb-3 text-sm font-semibold text-muted-foreground">
            {t("byState")}
          </h2>
          <ul className="flex flex-col gap-3">
            {merchantStatuses.map((s) => {
              const n = m.byState[s] ?? 0;
              return (
                <li key={s} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3">
                  <MerchantStatusBadge status={s} />
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-foreground/70"
                      style={{ width: `${total ? (n / total) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="text-end font-semibold" data-numeric>
                    {n}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
