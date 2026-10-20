import { ArrowLeft, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ShopNotice } from "@/components/storefront/shop-notice";
import { ShopRoot } from "@/components/storefront/shop-root";
import { OrderTicket } from "@/components/storefront/ordering/order-ticket";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";
import { shopTheme } from "@/lib/branding/theme";
import { pickText } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import { loadCustomerOrder, statusPayload } from "@/lib/orders/service";
import { assetUrl } from "@/lib/storage/public-url";

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token, locale } = await params;
  const order = await loadCustomerOrder(token);
  const t = await getTranslations("order.status");
  // Never indexed, never previewed: the URL is the customer's only credential.
  const base: Metadata = { robots: { index: false, follow: false }, referrer: "same-origin" };
  if (!order) return { ...base, title: t("notFound.title") };
  const title = `${order.number} · ${order.shop.name}`;
  return {
    ...base,
    title,
    // "Add to Home Screen" installs this order (iPhone push needs the Home Screen app).
    manifest: `/api/orders/${token}/manifest?locale=${locale}`,
    appleWebApp: { capable: true, title, statusBarStyle: "default" },
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  };
}

export default async function OrderStatusPage({ params }: { params: Params }) {
  const locale = await initLocale(params);
  const { token } = await params;
  const t = await getTranslations("order");
  const format = await getFormatter();
  const order = await loadCustomerOrder(token);
  if (!order)
    return <ShopNotice title={t("status.notFound.title")} body={t("status.notFound.body")} />;

  const theme = shopTheme(order.shop.branding);
  const logo = assetUrl(order.shop.branding.logoPath);
  const money = (minor: number) => formatMoney(minor, order.currency, locale);

  return (
    <ShopRoot theme={theme} className="min-h-dvh">
      <header className="bg-[var(--brand)] text-[var(--brand-contrast)]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {order.shop.slug ? (
            <Link
              href={`/s/${order.shop.slug}`}
              aria-label={t("status.backToMenu")}
              className="grid size-10 place-items-center rounded-full hover:bg-[color-mix(in_srgb,var(--brand-contrast)_14%,transparent)]"
            >
              <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small, already resized logo
            <img
              src={logo}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full bg-white object-cover"
            />
          ) : null}
          <p className="truncate font-bold">{order.shop.name}</p>
        </div>
      </header>

      <main id="main" className="mx-auto flex max-w-lg flex-col gap-8 px-4 pt-6 pb-16">
        <OrderTicket token={token} initial={statusPayload(order)} fastPoll={order.isDemo}>
          <section
            aria-labelledby="order-items"
            className="rounded-3xl bg-[var(--shop-card)] p-5 shadow-[0_10px_30px_-22px_rgb(31_26_23/0.35)]"
          >
            <h2 id="order-items" className="mb-3 font-bold">
              {t("status.items")}
            </h2>
            <ul className="divide-y divide-[var(--shop-line)]">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    {/* <bdi>: an Arabic dish name in a French page must not drag the quantity across. */}
                    <p className="font-semibold">
                      <span className="tabular-nums">{item.quantity}×</span>{" "}
                      <bdi>{pickText(item.name, item.nameI18n, locale)}</bdi>
                    </p>
                    {item.options.length ? (
                      <p className="text-sm text-[var(--shop-muted)]">
                        {item.options.map((o) => pickText(o.name, o.nameI18n, locale)).join(" · ")}
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="text-sm text-[var(--shop-muted)] italic">“{item.note}”</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 tabular-nums">{money(item.lineTotalMinor)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-baseline justify-between border-t border-[var(--shop-line)] pt-3 text-lg font-bold">
              <span>{t("ticket.total")}</span>
              <span className="tabular-nums">{money(order.totalMinor)}</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-[var(--shop-muted)]">
              <Wallet className="size-4" aria-hidden />
              {t("ticket.payAtCounter")}
            </p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[var(--shop-muted)]">{t("status.name")}</dt>
              <dd className="font-semibold">{order.customerName}</dd>
              {order.tableLabel ? (
                <>
                  <dt className="text-[var(--shop-muted)]">{t("status.table")}</dt>
                  <dd className="font-semibold">{order.tableLabel}</dd>
                </>
              ) : null}
            </dl>
            <p className="mt-3 text-xs text-[var(--shop-muted)]">
              {t("status.placedAt", {
                time: format.dateTime(new Date(order.placedAt), {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: order.shop.timezone,
                }),
              })}
            </p>
          </section>
        </OrderTicket>
      </main>
    </ShopRoot>
  );
}
