import { and, eq } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/console/page-header";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { getProvider } from "@/lib/billing/providers";
import { serviceDb } from "@/lib/db/client";
import { invoices, payments } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { MockCheckoutButtons } from "./mock-checkout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.mock");
  return { title: t("title") };
}

/** Stand-in gateway page, only when PAYMENT_PROVIDERS includes "mock". */
export default async function MockCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const locale = await initLocale(params);
  if (!getProvider("mock")) notFound();
  const ctx = await requireOwner(locale);
  const { payment: paymentId } = await searchParams;
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) notFound();
  const t = await getTranslations("billing.mock");

  const [row] = await serviceDb
    .select({
      status: payments.status,
      amountMinor: payments.amountMinor,
      currency: payments.currency,
      number: invoices.number,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.merchantId, ctx.merchant.id),
        eq(payments.provider, "mock"),
      ),
    );
  if (!row) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title={t("title")} />
      <div className="flex flex-col gap-6 rounded-xl border border-dashed bg-card p-6">
        <FlaskConical className="size-6 text-primary" aria-hidden />
        <p className="leading-relaxed text-muted-foreground">{t("body")}</p>
        <p className="flex items-baseline justify-between gap-4">
          <span className="font-medium" dir="ltr">
            {t("invoice", { number: row.number })}
          </span>
          <span className="font-display text-2xl font-bold" data-numeric>
            {formatMoney(row.amountMinor, row.currency, locale)}
          </span>
        </p>
        {row.status === "pending" ? (
          <MockCheckoutButtons paymentId={paymentId} />
        ) : (
          <p className="text-muted-foreground">{t("unavailable")}</p>
        )}
      </div>
    </div>
  );
}
