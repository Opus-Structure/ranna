"use client";

import { CreditCard, FlaskConical, Gift, Landmark, Loader2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  changePlanAction,
  payOnlineAction,
  startTrialAction,
  submitManualPaymentAction,
  type BillingError,
} from "@/app/(console)/[locale]/dashboard/billing/actions";
import { describedBy, Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/images/compress";
import { cn } from "@/lib/utils";

export type PlanOption = {
  id: string;
  name: string;
  price: string;
  interval: string;
  features: string[];
  trialDays: number;
  isCurrent: boolean;
  isNext: boolean;
};

type Method = "trial" | "chargily" | "mock" | "manual";

export type ManualDetails = {
  beneficiary: string;
  bankName: string;
  rib: string;
  rip: string;
};

export function PlanCheckout({
  plans,
  initialPlanId,
  onlineMethods,
  manualEnabled,
  trialEligible,
  canSwitchAtRenewal,
  manualDetails,
  pendingReview,
}: {
  plans: PlanOption[];
  initialPlanId: string;
  onlineMethods: ("chargily" | "mock")[];
  manualEnabled: boolean;
  trialEligible: boolean;
  /** Active paid subscription: other plans can be queued for the next renewal. */
  canSwitchAtRenewal: boolean;
  manualDetails: ManualDetails;
  pendingReview: boolean;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const router = useRouter();
  const [planId, setPlanId] = useState(initialPlanId);
  const plan = plans.find((p) => p.id === planId) ?? plans[0]!;
  const methods: Method[] = [
    ...(trialEligible && plan.trialDays > 0 ? (["trial"] as const) : []),
    ...onlineMethods,
    ...(manualEnabled ? (["manual"] as const) : []),
  ];
  const [method, setMethod] = useState<Method>(methods[0] ?? "manual");
  const activeMethod = methods.includes(method) ? method : (methods[0] ?? "manual");
  const [error, setError] = useState<BillingError | null>(null);
  const [pending, startTransition] = useTransition();
  const groupName = useId();

  function run(
    action: () => Promise<{ ok: true; redirectUrl?: string } | { ok: false; error: BillingError }>,
    success?: string,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.redirectUrl) {
          window.location.assign(result.redirectUrl);
          return;
        }
        if (success) toast.success(success);
        router.refresh();
      } catch {
        setError("generic");
      }
    });
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) form.set("receipt", await compressImage(file));
    form.set("planId", plan.id);
    run(() => submitManualPaymentAction(form));
  }

  const methodMeta: Record<Method, { label: string; hint: string; icon: ReactNode }> = {
    trial: {
      label: t("plans.trial", { days: plan.trialDays }),
      hint: t("pay.trialHint"),
      icon: <Gift className="size-4" aria-hidden />,
    },
    chargily: {
      label: t("pay.chargily"),
      hint: t("pay.chargilyHint"),
      icon: <CreditCard className="size-4" aria-hidden />,
    },
    mock: {
      label: t("pay.mock"),
      hint: t("pay.mockHint"),
      icon: <FlaskConical className="size-4" aria-hidden />,
    },
    manual: {
      label: t("pay.manual"),
      hint: t("pay.manualHint"),
      icon: <Landmark className="size-4" aria-hidden />,
    },
  };

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-4 font-display text-xl font-semibold">{t("plans.heading")}</legend>
        <div className="grid gap-3 lg:grid-cols-3">
          {plans.map((p) => (
            <label
              key={p.id}
              className={cn(
                "relative flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-5 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                p.id === planId ? "border-primary ring-1 ring-primary" : "hover:border-input",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={p.id}
                checked={p.id === planId}
                onChange={() => setPlanId(p.id)}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-3">
                <span className="font-display text-lg font-semibold">{p.name}</span>
                {p.isCurrent || p.isNext ? (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                    {p.isCurrent ? t("plans.current") : t("plans.next")}
                  </span>
                ) : null}
              </span>
              <span className="flex items-baseline gap-1.5" data-numeric>
                <span className="font-display text-3xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.interval}</span>
              </span>
              <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rotate-45 rounded-[1px] bg-foreground/50"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </label>
          ))}
        </div>
      </fieldset>

      <section
        aria-labelledby="pay-heading"
        className="flex flex-col gap-6 rounded-xl border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="pay-heading" className="font-display text-xl font-semibold">
            {t("pay.heading", { plan: plan.name })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("pay.amountDue")}{" "}
            <span className="font-display text-lg font-semibold text-foreground" data-numeric>
              {plan.price}
            </span>
          </p>
        </div>

        {canSwitchAtRenewal && !plan.isCurrent && !plan.isNext ? (
          <Button
            variant="outline"
            className="self-start"
            disabled={pending}
            onClick={() => run(() => changePlanAction(plan.id), t("current.changeQueued"))}
          >
            {t("current.changePlan")}
          </Button>
        ) : null}

        {error ? (
          <Alert variant="destructive" aria-live="assertive">
            <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
          </Alert>
        ) : null}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">{t("pay.methods")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {methods.map((m) => (
              <label
                key={m}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                  activeMethod === m ? "border-primary bg-primary/6" : "hover:bg-accent/60",
                )}
              >
                <input
                  type="radio"
                  name={`${groupName}-method`}
                  value={m}
                  checked={activeMethod === m}
                  onChange={() => setMethod(m)}
                  className="sr-only"
                />
                {methodMeta[m].icon}
                {methodMeta[m].label}
              </label>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {methodMeta[activeMethod].hint}
          </p>
        </fieldset>

        {activeMethod === "trial" ? (
          <Button
            size="lg"
            className="h-12 self-start px-6"
            disabled={pending}
            onClick={() => run(() => startTrialAction(plan.id))}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("pay.trial", { days: plan.trialDays })}
          </Button>
        ) : activeMethod === "manual" ? (
          <ManualPayment
            details={manualDetails}
            pending={pending}
            disabled={pendingReview}
            onSubmit={submitManual}
          />
        ) : (
          <Button
            size="lg"
            className="h-12 self-start px-6"
            disabled={pending}
            onClick={() => run(() => payOnlineAction(locale, plan.id, activeMethod))}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("pay.continue")}
          </Button>
        )}
      </section>
    </div>
  );
}

function ManualPayment({
  details,
  pending,
  disabled,
  onSubmit,
}: {
  details: ManualDetails;
  pending: boolean;
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const t = useTranslations("billing.manual");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-lg bg-muted/60 p-4 text-sm">
        <dt className="text-muted-foreground">{t("beneficiary")}</dt>
        <dd className="font-medium">{details.beneficiary}</dd>
        <dt className="text-muted-foreground">{t("bank")}</dt>
        <dd className="font-medium">{details.bankName}</dd>
        <dt className="text-muted-foreground">{t("rib")}</dt>
        <dd className="font-medium" dir="ltr" data-numeric>
          {details.rib}
        </dd>
        <dt className="text-muted-foreground">{t("baridimob")}</dt>
        <dd className="font-medium" dir="ltr" data-numeric>
          {details.rip}
        </dd>
        <dd className="col-span-2 pt-1 text-muted-foreground">{t("cash")}</dd>
      </dl>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={disabled || pending} className="flex flex-col gap-4">
          <Field id="reference" label={t("reference")}>
            <Input id="reference" name="reference" maxLength={120} className="h-11" />
          </Field>
          <Field id="receipt" label={t("receipt")}>
            <Input
              id="receipt"
              name="receipt"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="h-11 py-2"
              aria-describedby={describedBy("receipt", {})}
            />
          </Field>
          <Button type="submit" size="lg" className="h-12 self-start px-6">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {t("submit")}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
