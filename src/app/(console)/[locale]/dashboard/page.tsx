import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WaitBand } from "@/components/brand/wait-band";
import { PageHeader } from "@/components/console/page-header";
import { Link } from "@/i18n/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getOverview, type Lane } from "@/lib/merchants/overview";
import { formatMoney } from "@/lib/money";
import { minutesBetween } from "@/lib/time";
import { cn } from "@/lib/utils";
import { initLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.overview");
  return { title: t("title") };
}

const laneTone = {
  new: "bg-state-new",
  preparing: "bg-state-preparing",
  ready: "bg-state-ready",
} as const;

export default async function OverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  const t = await getTranslations("console.overview");
  const now = new Date();
  const data = await getOverview(ctx.user.id, ctx.merchant, now);
  const steps = [
    { key: "plan", href: "/dashboard/billing", done: data.setup.plan },
    { key: "shop", href: "/dashboard/shop", done: data.setup.shop },
    { key: "menu", href: "/dashboard/menu", done: data.setup.menu },
    { key: "qr", href: "/dashboard/qr", done: data.setup.qr },
  ] as const;
  const setupDone = steps.every((s) => s.done);

  return (
    <>
      <PageHeader title={t("title")} />

      <section aria-labelledby="service-now" className="flex flex-col gap-3">
        <h2 id="service-now" className="text-sm font-semibold text-muted-foreground">
          {t("serviceNow")}
        </h2>
        <div className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(220px,0.85fr)]">
          <div className="grid grid-cols-3 lg:contents">
            {(["new", "preparing", "ready"] as const).map((key) => (
              <LaneCell
                key={key}
                label={t(`lanes.${key}`)}
                lane={data.lanes[key]}
                tone={laneTone[key]}
                target={data.prepTargetMinutes}
                now={now}
              />
            ))}
          </div>
          <Link
            href="/dashboard/orders"
            className="group flex min-h-24 items-end justify-between gap-4 bg-clay p-6 text-clay-foreground transition-colors hover:bg-clay-hover focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary lg:min-h-0 lg:flex-col lg:items-start"
          >
            <ArrowUpRight
              className="size-6 transition-transform duration-300 ease-(--ease-out-expo) group-hover:translate-x-0.5 group-hover:-translate-y-0.5 lg:order-first rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
            <span className="font-display text-xl leading-snug font-semibold">
              {t("openBoard")}
            </span>
          </Link>
        </div>
      </section>

      <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground">
        <span className="font-semibold text-foreground">{t("today")}</span>
        <span aria-hidden>·</span>
        <span data-numeric>{t("ordersToday", { count: data.today.orders })}</span>
        <span aria-hidden>·</span>
        <span>
          {t("revenueToday")}{" "}
          <span className="font-semibold text-foreground" data-numeric>
            {formatMoney(data.today.collectedMinor, ctx.merchant.currency, locale)}
          </span>
        </span>
      </p>

      {setupDone ? null : (
        <section aria-labelledby="setup" className="mt-12 max-w-2xl">
          <h2 id="setup" className="mb-4 font-display text-xl font-semibold">
            {t("setupTitle")}
          </h2>
          <ol className="divide-y rounded-xl border">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className="flex min-h-14 items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rotate-45 rounded-[1px] border-[1.5px]",
                      step.done ? "border-state-ready bg-state-ready" : "border-input",
                    )}
                  />
                  <span
                    className={cn(
                      "flex-1",
                      step.done && "text-muted-foreground line-through decoration-1",
                    )}
                  >
                    {t(`setup.${step.key}`)}
                  </span>
                  <ChevronRight
                    className="size-4 text-muted-foreground rtl:rotate-180"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

function LaneCell({
  label,
  lane,
  tone,
  target,
  now,
}: {
  label: string;
  lane: Lane;
  tone: string;
  target: number;
  now: Date;
}) {
  const waited = lane.oldestAt ? minutesBetween(lane.oldestAt, now) : 0;
  return (
    <div className="flex flex-col gap-4 border-e p-4 last:border-e-0 sm:p-6 lg:last:border-e">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className={cn("size-2 rotate-45 rounded-[1px]", tone)} />
        {label}
      </p>
      <p className="order-number text-5xl sm:text-6xl lg:text-7xl" data-numeric>
        {lane.count}
      </p>
      <WaitBand elapsedMinutes={lane.count ? waited : 0} targetMinutes={target} />
    </div>
  );
}
