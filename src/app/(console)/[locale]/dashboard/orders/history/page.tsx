import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { toneFor } from "@/components/orders/order-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { initLocale } from "@/i18n/server";
import { requireScreen } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { HISTORY_LIMIT, loadHistory } from "@/lib/orders/board";
import { ORDER_STATUSES } from "@/lib/orders/transitions";
import { businessDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders.history");
  return { title: t("title") };
}

type Search = Promise<{ date?: string; status?: string; q?: string }>;

/** Calendar arithmetic on YYYY-MM-DD strings (business dates have no time zone of their own). */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Search;
}) {
  const locale = (await initLocale(params)) as AppLocale;
  const ctx = await requireScreen(locale, "orders");
  const t = await getTranslations("orders");
  const format = await getFormatter();
  const query = await searchParams;
  const history = await loadHistory(ctx, query);
  const today = businessDate(new Date(), ctx.merchant.timezone);
  const money = (minor: number) => formatMoney(minor, ctx.merchant.currency, locale);
  const status = ORDER_STATUSES.includes(query.status as never) ? query.status! : "all";
  const dayHref = (date: string) => ({ pathname: "/dashboard/orders/history", query: { date } });
  const dayLabel = format.dateTime(new Date(`${history.date}T12:00:00Z`), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const totals = [
    { label: t("history.totals.orders"), value: String(history.totals.orders) },
    { label: t("history.totals.completed"), value: String(history.totals.completed) },
    { label: t("history.totals.canceled"), value: String(history.totals.canceled) },
    { label: t("history.totals.collected"), value: money(history.totals.collectedMinor) },
    { label: t("history.totals.average"), value: money(history.totals.averageMinor) },
  ];

  return (
    <>
      <PageHeader
        title={t("history.title")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/orders">{t("history.board")}</Link>
            </Button>
            {ctx.role === "owner" ? (
              <Button asChild variant="outline">
                <a href={`/api/orders/export?date=${history.date}&locale=${locale}`} download>
                  <Download className="size-4" aria-hidden />
                  {t("history.export")}
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("history.previousDay")}>
          <Link href={dayHref(shiftDate(history.date, -1))}>
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-48 text-center font-display text-lg font-semibold">
          {history.date === today ? t("history.today") : dayLabel}
        </h2>
        {history.date < today ? (
          <Button asChild variant="ghost" size="icon" aria-label={t("history.nextDay")}>
            <Link href={dayHref(shiftDate(history.date, 1))}>
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : (
          <span className="size-9" aria-hidden />
        )}
      </div>

      <dl className="mb-8 grid grid-cols-2 border-y sm:grid-cols-3 lg:grid-cols-5">
        {totals.map((x) => (
          <div key={x.label} className="flex flex-col gap-1 border-e px-4 py-4 last:border-e-0">
            <dt className="text-sm text-muted-foreground">{x.label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>

      <form className="mb-6 flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("history.date")}
          <Input
            type="date"
            name="date"
            defaultValue={history.date}
            max={today}
            className="h-10 w-44"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("history.status")}
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal"
          >
            <option value="all">{t("history.all")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-semibold">
          {t("history.searchLabel")}
          <Input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            maxLength={40}
            placeholder={t("history.search")}
            className="h-10"
          />
        </label>
        <Button type="submit" className="h-10">
          {t("history.apply")}
        </Button>
      </form>

      {history.orders.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
          {history.totals.orders === 0 ? t("history.empty") : t("history.noMatch")}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <caption className="sr-only">{t("history.title")}</caption>
            <thead className="border-b text-start text-muted-foreground max-md:sr-only">
              <tr>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {t("history.columns.number")}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {t("history.columns.time")}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {t("history.columns.customer")}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {t("history.columns.items")}
                </th>
                <th scope="col" className="py-2 pe-4 text-end font-medium">
                  {t("history.columns.total")}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {t("history.columns.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.orders.map((o) => (
                <tr
                  key={o.id}
                  className="align-top max-md:grid max-md:grid-cols-[auto_1fr_auto] max-md:gap-x-3 max-md:py-3"
                >
                  <td className="py-3 pe-4 order-number text-2xl max-md:row-span-3 max-md:py-0">
                    {o.number}
                  </td>
                  <td className="py-3 pe-4 text-muted-foreground tabular-nums max-md:col-start-3 max-md:py-0 max-md:text-end">
                    {format.dateTime(new Date(o.placedAt), {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: ctx.merchant.timezone,
                    })}
                  </td>
                  <td className="py-3 pe-4 font-semibold max-md:col-start-2 max-md:row-start-1 max-md:py-0">
                    {o.customerName}
                    {o.tableLabel ? (
                      <span className="ms-2 font-normal text-muted-foreground">
                        · {o.tableLabel}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pe-4 max-md:col-span-2 max-md:col-start-2 max-md:py-0.5">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    {o.cancelReason ? (
                      <span className="block text-muted-foreground">
                        {t("history.reason", { reason: o.cancelReason })}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pe-4 text-end font-semibold tabular-nums max-md:col-start-3 max-md:row-start-2 max-md:py-0">
                    {money(o.totalMinor)}
                  </td>
                  <td className="py-3 max-md:col-start-2 max-md:py-0">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rotate-45 rounded-[1px]", toneFor[o.status])}
                      />
                      {t(`status.${o.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.orders.length >= HISTORY_LIMIT ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("history.truncated", { limit: HISTORY_LIMIT })}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
