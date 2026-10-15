import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isUnlimitedItems } from "@/config/plans";
import type { AppLocale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/paths";
import { getPublicPlans } from "@/lib/billing/public-plans";
import { pickText } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Three packs, one of them the offer: the middle pack is the clay plate with a "most popular"
 * mark; each card lists only what differs between packs (dishes, table codes, staff), and what
 * every pack includes is said once underneath. Everything listed is a real limit or feature.
 */
export async function Pricing({ locale }: { locale: AppLocale }) {
  const t = await getTranslations("site.pricing");
  const plans = await getPublicPlans();
  if (plans.length === 0) return null;
  const signup = localizedPath("/signup", locale);
  const featuredIndex = Math.max(
    0,
    plans.findIndex((p) => p.code === "diamant"),
  );
  const first = plans[0]!;
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

      <ul className="mt-12 grid items-start gap-6 md:grid-cols-3">
        {plans.map((p, i) => {
          const name = pickText(p.name, p.nameI18n, locale);
          const featured = i === featuredIndex;
          const rows = [
            {
              label: t("rows.items"),
              value: isUnlimitedItems(p.limits.maxItems)
                ? t("unlimited")
                : String(p.limits.maxItems),
            },
            {
              label: t("rows.tables"),
              value: p.limits.maxTables == null ? t("unlimited") : String(p.limits.maxTables),
            },
            { label: t("rows.staff"), value: String(p.limits.maxStaff) },
          ];
          return (
            <li
              key={p.code}
              className={cn(
                "relative flex flex-col rounded-2xl border",
                featured
                  ? "border-transparent bg-clay pt-4 text-clay-foreground shadow-[0_30px_60px_-34px_oklch(0.38_0.105_30/0.8)] md:-mt-4"
                  : "bg-card",
              )}
            >
              {featured ? (
                <p className="mx-6 mb-1 inline-flex w-fit items-center gap-2 rounded-full bg-clay-foreground px-3 py-1 text-sm font-bold text-clay">
                  <span aria-hidden className="size-2 rotate-45 rounded-[1px] bg-primary" />
                  {t("popular")}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 px-6 pt-5 pb-4">
                <h3 className="font-display text-2xl leading-tight font-bold">{name}</h3>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-4xl font-bold tabular-nums">
                    {formatMoney(p.priceMinor, p.currency, locale)}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      featured ? "text-clay-muted" : "text-muted-foreground",
                    )}
                  >
                    {t(`per.${p.interval}`)}
                  </span>
                </p>
                {featured ? <p className="text-sm text-clay-muted">{t("popularHint")}</p> : null}
              </div>
              <span
                aria-hidden
                className={cn(
                  "mx-6 lattice",
                  featured ? "text-clay-foreground" : "text-foreground",
                )}
              />
              <dl className="flex flex-1 flex-col px-6 py-3">
                {rows.map((r) => (
                  <div
                    key={r.label}
                    className={cn(
                      "flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0",
                      featured ? "border-clay-line" : "border-border",
                    )}
                  >
                    <dt className={featured ? "text-clay-muted" : "text-muted-foreground"}>
                      {r.label}
                    </dt>
                    <dd className="font-display text-xl font-bold tabular-nums">{r.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="px-6 pt-2 pb-6">
                <a
                  href={signup}
                  className={cn(
                    "inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-base font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3",
                    featured
                      ? "bg-clay-foreground text-clay hover:bg-white focus-visible:outline-clay-foreground"
                      : "border-2 border-foreground hover:bg-foreground hover:text-background focus-visible:outline-primary",
                  )}
                >
                  {t("start", { plan: name })}
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 rounded-2xl bg-muted/60 px-6 py-6">
        <h3 className="font-display text-lg font-bold">{t("includedTitle")}</h3>
        <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            first.trialDays > 0 ? t("trial", { days: first.trialDays }) : null,
            t(first.interval === "year" ? "billedYear" : "billedMonth"),
            first.limits.maxMonthlyOrders === null
              ? t("ordersUnlimited")
              : t("orders", { count: first.limits.maxMonthlyOrders }),
            t("common.ring"),
            t("common.board"),
            t("common.languages"),
          ]
            .filter((x): x is string => x !== null)
            .map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <Check className="mt-1 size-4 shrink-0 text-state-ready" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
        </ul>
      </div>
      <p className="mt-6 max-w-[70ch] text-sm text-muted-foreground">{t("payment")}</p>
    </section>
  );
}
