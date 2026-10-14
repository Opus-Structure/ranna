import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlanCheckout, type PlanOption } from "@/components/billing/plan-checkout";
import { SubscriptionActions } from "@/components/billing/subscription-actions";
import { MerchantStatusBadge } from "@/components/console/merchant-status-badge";
import { PageHeader } from "@/components/console/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { manualPaymentInstructions } from "@/config/billing";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { enabledProviderIds } from "@/lib/billing/providers";
import { getBillingView } from "@/lib/billing/queries";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

const invoiceTone = {
  paid: "text-state-ready",
  open: "text-primary",
  void: "text-muted-foreground",
  failed: "text-destructive",
} as const;

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const locale = await initLocale(params);
  const { checkout } = await searchParams;
  const ctx = await requireOwner(locale);
  const t = await getTranslations("billing");
  const format = await getFormatter();
  const view = await getBillingView(ctx.user.id, ctx.merchant.id);
  const { merchant } = ctx;
  const sub = view.subscription;
  const providers = enabledProviderIds();
  const date = (d: Date | null) => (d ? format.dateTime(d, "short") : "");

  const planName = (id: string | null | undefined) => {
    const plan = view.plans.find((p) => p.id === id);
    return plan ? (plan.nameI18n[locale] ?? plan.name) : null;
  };
  const currentPlanId = sub?.planId ?? null;
  const trialEligible = merchant.status === "pending_payment" && !sub?.trialUsed;
  const options: PlanOption[] = view.plans.map((p) => ({
    id: p.id,
    name: p.nameI18n[locale] ?? p.name,
    price: formatMoney(p.priceMinor, p.currency, locale),
    interval: p.interval === "year" ? t("plans.perYear") : t("plans.perMonth"),
    trialDays: p.trialDays,
    isCurrent: p.id === currentPlanId && merchant.status !== "pending_payment",
    isNext: p.id === sub?.pendingPlanId,
    features: [
      t("plans.items", { count: p.limits.maxItems }),
      t("plans.staff", { count: p.limits.maxStaff }),
      p.limits.maxMonthlyOrders === null
        ? t("plans.ordersUnlimited")
        : t("plans.orders", { count: p.limits.maxMonthlyOrders }),
      ...(p.trialDays > 0 && trialEligible ? [t("plans.trial", { days: p.trialDays })] : []),
    ],
  }));
  const initialPlanId =
    sub?.pendingPlanId ?? currentPlanId ?? view.plans[1]?.id ?? view.plans[0]?.id ?? "";

  const statusLine =
    merchant.status === "past_due"
      ? t("current.graceUntil", { date: date(merchant.graceUntil) })
      : merchant.status === "active" && sub?.isTrial
        ? t("current.trialEnds", { date: date(merchant.periodEnd) })
        : merchant.status === "active" && sub?.cancelAtPeriodEnd
          ? t("current.endsOn", { date: date(merchant.periodEnd) })
          : merchant.status === "active"
            ? t("current.renews", { date: date(merchant.periodEnd) })
            : null;

  return (
    <>
      <PageHeader title={t("title")} />

      {checkout === "success" || checkout === "failed" ? (
        <Alert
          variant={checkout === "failed" ? "destructive" : "default"}
          className="mb-6"
          role="status"
        >
          {checkout === "success" ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
          <AlertDescription>{t(`checkout.${checkout}`)}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="current-plan" className="mb-10 flex flex-col gap-4 border-b pb-8">
        <h2 id="current-plan" className="text-sm font-semibold text-muted-foreground">
          {t("current.heading")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center gap-3">
              <span className="font-display text-2xl font-bold">
                {planName(currentPlanId) ?? t("current.none")}
              </span>
              <MerchantStatusBadge status={merchant.status} />
            </p>
            {statusLine ? <p className="text-muted-foreground">{statusLine}</p> : null}
            {sub?.pendingPlanId ? (
              <p className="text-sm text-muted-foreground">
                {t("current.pendingPlan", { plan: planName(sub.pendingPlanId) ?? "" })}
              </p>
            ) : null}
          </div>
          <SubscriptionActions
            cancelScheduled={merchant.status === "active" && Boolean(sub?.cancelAtPeriodEnd)}
            cancelable={["active", "past_due", "suspended"].includes(merchant.status)}
            endsOn={date(merchant.periodEnd)}
            endsNow={merchant.status !== "active" || Boolean(sub?.isTrial)}
          />
        </div>
      </section>

      {view.pendingReview ? (
        <Alert className="mb-6" role="status">
          <Clock aria-hidden />
          <AlertDescription>
            {t("manual.pending", { date: date(view.pendingReview.createdAt) })}
          </AlertDescription>
        </Alert>
      ) : view.lastRejected && merchant.status !== "active" ? (
        <Alert variant="destructive" className="mb-6">
          <XCircle aria-hidden />
          <AlertDescription>
            {view.lastRejected.reviewNote
              ? t("manual.rejected", { note: view.lastRejected.reviewNote })
              : t("manual.rejectedNoNote")}
          </AlertDescription>
        </Alert>
      ) : null}

      {options.length > 0 ? (
        <PlanCheckout
          plans={options}
          initialPlanId={initialPlanId}
          onlineMethods={providers.filter(
            (p): p is "chargily" | "mock" => p === "chargily" || p === "mock",
          )}
          manualEnabled={providers.includes("manual")}
          trialEligible={trialEligible}
          canSwitchAtRenewal={merchant.status === "active" && !sub?.isTrial}
          manualDetails={{
            beneficiary: manualPaymentInstructions.beneficiary,
            bankName: manualPaymentInstructions.bank.name,
            rib: manualPaymentInstructions.bank.rib,
            rip: manualPaymentInstructions.baridimob.rip,
          }}
          pendingReview={Boolean(view.pendingReview)}
        />
      ) : null}

      <section aria-labelledby="invoices" className="mt-12">
        <h2 id="invoices" className="mb-4 font-display text-xl font-semibold">
          {t("invoices.heading")}
        </h2>
        {view.invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
            {t("invoices.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.number")}</TableHead>
                  <TableHead>{t("invoices.period")}</TableHead>
                  <TableHead>{t("invoices.amount")}</TableHead>
                  <TableHead>{t("invoices.method")}</TableHead>
                  <TableHead>{t("invoices.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium" dir="ltr">
                      {inv.number}
                    </TableCell>
                    <TableCell>
                      {inv.periodStart && inv.periodEnd
                        ? `${date(inv.periodStart)} – ${date(inv.periodEnd)}`
                        : "–"}
                    </TableCell>
                    <TableCell>{formatMoney(inv.amountMinor, inv.currency, locale)}</TableCell>
                    <TableCell>
                      {inv.provider ? t(`invoices.providers.${inv.provider}`) : "–"}
                    </TableCell>
                    <TableCell className={cn("font-semibold", invoiceTone[inv.status])}>
                      {t(`invoices.statuses.${inv.status}`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
