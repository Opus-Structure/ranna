"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  saveOrderingSettingsAction,
  saveRegionalAction,
} from "@/app/(console)/[locale]/dashboard/shop/actions";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { KITCHEN_ROUTING, TICKET_WIDTHS, routesToPrint } from "@/lib/orders/kitchen";
import { CURRENCIES, TIMEZONES } from "@/lib/validation/shop";

type Values = {
  prepTargetMinutes: number;
  askPhone: boolean;
  phoneRetentionDays: number;
  fallbackMessaging: boolean;
  kitchenRouting: (typeof KITCHEN_ROUTING)[number];
  ticketWidthMm: (typeof TICKET_WIDTHS)[number];
  currency: (typeof CURRENCIES)[number];
  timezone: (typeof TIMEZONES)[number];
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-b pb-8 last:border-b-0">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  );
}

export function SettingsForm({ initial, readOnly }: { initial: Values; readOnly: boolean }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Values>(k: K, value: Values[K]) =>
    setV((s) => ({ ...s, [k]: value }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const ordering = await saveOrderingSettingsAction({
        prepTargetMinutes: v.prepTargetMinutes,
        askPhone: v.askPhone,
        phoneRetentionDays: v.phoneRetentionDays,
        fallbackMessaging: v.fallbackMessaging,
        kitchenRouting: v.kitchenRouting,
        ticketWidthMm: v.ticketWidthMm,
      });
      const regional = ordering.ok
        ? await saveRegionalAction({ currency: v.currency, timezone: v.timezone })
        : ordering;
      if (!regional.ok) {
        const key = ["locked", "forbidden"].includes(regional.error) ? regional.error : "invalid";
        toast.error(t(`errors.${key}` as "errors.invalid"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-8">
      <Section title={t("ordering")}>
        <Field id="prep-target" label={t("prepTarget")} hint={t("prepTargetHint")}>
          <Input
            id="prep-target"
            type="number"
            min={3}
            max={90}
            dir="ltr"
            value={v.prepTargetMinutes}
            onChange={(e) => set("prepTargetMinutes", Number(e.target.value))}
            className="h-11 w-28"
          />
        </Field>
        <ToggleRow
          label={t("askPhone")}
          hint={t("askPhoneHint")}
          checked={v.askPhone}
          onChange={(x) => set("askPhone", x)}
        />
        <ToggleRow
          label={t("fallbackMessaging")}
          hint={t("fallbackMessagingHint")}
          checked={v.fallbackMessaging}
          onChange={(x) => set("fallbackMessaging", x)}
        />
      </Section>
      <Section title={t("kitchen.title")}>
        <p className="-mt-2 text-sm text-muted-foreground">{t("kitchen.intro")}</p>
        <RadioGroup
          aria-label={t("kitchen.title")}
          value={v.kitchenRouting}
          onValueChange={(x) => set("kitchenRouting", x as Values["kitchenRouting"])}
          disabled={readOnly}
        >
          {KITCHEN_ROUTING.map((mode) => (
            <label
              key={mode}
              htmlFor={`kitchen-${mode}`}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-foreground"
            >
              <RadioGroupItem id={`kitchen-${mode}`} value={mode} className="mt-1 size-5" />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{t(`kitchen.modes.${mode}.label`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t(`kitchen.modes.${mode}.hint`)}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
        {routesToPrint(v.kitchenRouting) ? (
          <Field id="ticket-width" label={t("kitchen.width")} hint={t("kitchen.widthHint")}>
            <select
              id="ticket-width"
              value={v.ticketWidthMm}
              onChange={(e) =>
                set("ticketWidthMm", Number(e.target.value) as Values["ticketWidthMm"])
              }
              className="h-11 w-40 rounded-md border border-input bg-card px-3 focus-visible:outline-ring"
            >
              {TICKET_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w} mm
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </Section>
      <Section title={t("privacy")}>
        <Field id="retention" label={t("retention")} hint={t("retentionHint")}>
          <Input
            id="retention"
            type="number"
            min={1}
            max={90}
            dir="ltr"
            value={v.phoneRetentionDays}
            onChange={(e) => set("phoneRetentionDays", Number(e.target.value))}
            className="h-11 w-28"
          />
        </Field>
      </Section>
      <Section title={t("regional")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="currency" label={t("currency")}>
            <select
              id="currency"
              value={v.currency}
              onChange={(e) => set("currency", e.target.value as Values["currency"])}
              className="h-11 rounded-md border border-input bg-card px-3 focus-visible:outline-ring"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field id="timezone" label={t("timezone")} hint={t("timezoneHint")}>
            <select
              id="timezone"
              value={v.timezone}
              onChange={(e) => set("timezone", e.target.value as Values["timezone"])}
              className="h-11 rounded-md border border-input bg-card px-3 focus-visible:outline-ring"
              dir="ltr"
            >
              {TIMEZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>
      <Button
        type="submit"
        size="lg"
        className="h-11 self-start px-6"
        disabled={pending || readOnly}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("save")}
      </Button>
    </form>
  );
}
