import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getPublicPlans } from "@/lib/billing/public-plans";
import { pickText } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import { localizedPath } from "@/lib/auth/paths";

/**
 * Prices as the platform admin configured them, set as a ledger (one row per plan, the same
 * columns for each) so plans compare at a glance; no "most popular" badge, which we can't back.
 */
export async function Pricing({ locale }: { locale: AppLocale }) {
  const t = await getTranslations("site.pricing");
  const plans = await getPublicPlans();
  if (plans.length === 0) return null;
  const signup = localizedPath("/signup", locale);
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <h2 id="pricing-title" className="font-display text-3xl leading-tight font-bold sm:text-4xl">
        {t("title")}
      </h2>
      <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">{t("body")}</p>

      <table className="mt-10 w-full border-collapse text-start">
        <caption className="sr-only">{t("title")}</caption>
        <thead className="text-sm text-muted-foreground max-md:sr-only">
          <tr className="border-b-2 border-foreground">
            <th scope="col" className="py-3 pe-4 text-start font-medium">
              {t("cols.plan")}
            </th>
            <th scope="col" className="py-3 pe-4 text-start font-medium">
              {t("cols.price")}
            </th>
            <th scope="col" className="py-3 pe-4 text-start font-medium">
              {t("cols.items")}
            </th>
            <th scope="col" className="py-3 pe-4 text-start font-medium">
              {t("cols.staff")}
            </th>
            <th scope="col" className="py-3 pe-4 text-start font-medium">
              {t("cols.orders")}
            </th>
            <th scope="col" className="py-3 text-start font-medium">
              <span className="sr-only">{t("cols.start")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => {
            const name = pickText(p.name, p.nameI18n, locale);
            return (
              <tr
                key={p.code}
                className="border-b align-middle max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-1 max-md:py-5"
              >
                <th scope="row" className="py-6 pe-4 text-start max-md:col-span-2 max-md:py-0">
                  <span className="font-display text-2xl font-bold">{name}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {p.trialDays > 0 ? t("trial", { days: p.trialDays }) : t("noTrial")}
                  </span>
                </th>
                <td className="py-6 pe-4 max-md:col-span-2 max-md:py-1">
                  <span className="font-display text-3xl font-bold tabular-nums">
                    {formatMoney(p.priceMinor, p.currency, locale)}
                  </span>
                  <span className="text-muted-foreground"> {t(`per.${p.interval}`)}</span>
                </td>
                <td className="py-6 pe-4 tabular-nums max-md:py-0">
                  <span className="text-muted-foreground md:hidden">{t("cols.items")}: </span>
                  {p.limits.maxItems}
                </td>
                <td className="py-6 pe-4 tabular-nums max-md:py-0">
                  <span className="text-muted-foreground md:hidden">{t("cols.staff")}: </span>
                  {p.limits.maxStaff}
                </td>
                <td className="py-6 pe-4 tabular-nums max-md:col-span-2 max-md:py-0">
                  <span className="text-muted-foreground md:hidden">{t("cols.orders")}: </span>
                  {p.limits.maxMonthlyOrders === null
                    ? t("unlimited")
                    : t("perMonth", { count: p.limits.maxMonthlyOrders })}
                </td>
                <td className="py-6 text-end max-md:col-span-2 max-md:pt-3 max-md:text-start">
                  <a
                    href={signup}
                    className="inline-flex h-11 items-center rounded-xl border-2 border-foreground px-4 text-sm font-bold whitespace-nowrap transition-colors hover:bg-foreground hover:text-background focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
                  >
                    {t("start", { plan: name })}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-6 max-w-[70ch] text-sm text-muted-foreground">{t("payment")}</p>
      {/* Prices are not final yet (PRODUCT.md): say so where they are shown. */}
      <p className="mt-2 max-w-[70ch] text-sm font-semibold">{t("provisional")}</p>
    </section>
  );
}
