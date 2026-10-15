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
 * The packs, as configured by the platform admin: one price per pack, the free period up front,
 * then exactly what the pack includes. Everything listed is a real limit or feature of the
 * product (no "coming soon" lines); the top pack is the clay plate.
 */
export async function Pricing({ locale }: { locale: AppLocale }) {
  const t = await getTranslations("site.pricing");
  const plans = await getPublicPlans();
  if (plans.length === 0) return null;
  const signup = localizedPath("/signup", locale);
  const top = plans.length - 1;
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

      <ul className="mt-10 grid items-start gap-6 md:grid-cols-3">
        {plans.map((p, i) => {
          const name = pickText(p.name, p.nameI18n, locale);
          const featured = i === top;
          const features = [
            p.trialDays > 0 ? { text: t("trial", { days: p.trialDays }), strong: true } : null,
            { text: t(p.interval === "year" ? "billedYear" : "billedMonth"), strong: true },
            {
              text: isUnlimitedItems(p.limits.maxItems)
                ? t("itemsUnlimited")
                : t("items", { count: p.limits.maxItems }),
              strong: isUnlimitedItems(p.limits.maxItems),
            },
            {
              text:
                p.limits.maxTables == null
                  ? t("tablesUnlimited")
                  : t("tables", { count: p.limits.maxTables }),
              strong: false,
            },
            { text: t("staff", { count: p.limits.maxStaff }), strong: false },
            {
              text:
                p.limits.maxMonthlyOrders === null
                  ? t("ordersUnlimited")
                  : t("orders", { count: p.limits.maxMonthlyOrders }),
              strong: false,
            },
            { text: t("common.ring"), strong: false },
            { text: t("common.board"), strong: false },
            { text: t("common.languages"), strong: false },
          ].filter((f): f is { text: string; strong: boolean } => f !== null);
          return (
            <li
              key={p.code}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border",
                featured ? "border-transparent bg-clay text-clay-foreground" : "bg-card",
              )}
            >
              <div className="flex flex-col gap-3 px-6 pt-6 pb-4">
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
              </div>
              <span
                aria-hidden
                className={cn(
                  "mx-6 lattice",
                  featured ? "text-clay-foreground" : "text-foreground",
                )}
              />
              <ul className="flex flex-1 flex-col gap-2.5 px-6 py-5">
                {features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        "mt-1 size-4 shrink-0",
                        featured ? "text-clay-foreground" : "text-state-ready",
                      )}
                      aria-hidden
                    />
                    <span className={cn(f.strong && "font-bold")}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <div className="px-6 pb-6">
                <a
                  href={signup}
                  className={cn(
                    "inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-base font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3",
                    featured
                      ? "bg-clay-foreground text-clay hover:bg-white focus-visible:outline-clay-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary",
                  )}
                >
                  {t("start", { plan: name })}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 max-w-[70ch] text-sm text-muted-foreground">{t("payment")}</p>
    </section>
  );
}
