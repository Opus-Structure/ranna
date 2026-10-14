"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { updatePlanAction } from "@/app/(console)/[locale]/admin/actions";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type EditablePlan = {
  id: string;
  name: string;
  /** Major units for editing (e.g. 2900 DZD); converted back with `exponent`. */
  price: number;
  exponent: number;
  currency: string;
  trialDays: number;
  maxItems: number;
  maxStaff: number;
  maxMonthlyOrders: number | null;
  isActive: boolean;
};

export function PlanEditor({ plan }: { plan: EditablePlan }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const num = (k: string) => Number(String(f.get(k) ?? "").replace(",", "."));
    const orders = String(f.get("maxMonthlyOrders") ?? "").trim();
    startTransition(async () => {
      const result = await updatePlanAction(plan.id, {
        priceMinor: Math.round(num("price") * 10 ** plan.exponent),
        trialDays: num("trialDays"),
        maxItems: num("maxItems"),
        maxStaff: num("maxStaff"),
        maxMonthlyOrders: orders === "" ? null : Number(orders),
        isActive: f.get("isActive") === "on",
      });
      if (!result.ok) {
        toast.error(result.error === "invalid" ? t("errors.invalid") : t("errors.generic"));
        return;
      }
      toast.success(t("plans.saved"));
      router.refresh();
    });
  }

  const id = (k: string) => `${plan.id}-${k}`;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch name="isActive" defaultChecked={plan.isActive} />
          {t("plans.active")}
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={id("price")} label={`${t("plans.price")} (${plan.currency})`}>
          <Input
            id={id("price")}
            name="price"
            inputMode="decimal"
            defaultValue={plan.price}
            required
            dir="ltr"
          />
        </Field>
        <Field id={id("trialDays")} label={t("plans.trialDays")}>
          <Input
            id={id("trialDays")}
            name="trialDays"
            type="number"
            min={0}
            max={90}
            defaultValue={plan.trialDays}
            dir="ltr"
          />
        </Field>
        <Field id={id("maxItems")} label={t("plans.maxItems")}>
          <Input
            id={id("maxItems")}
            name="maxItems"
            type="number"
            min={1}
            defaultValue={plan.maxItems}
            dir="ltr"
          />
        </Field>
        <Field id={id("maxStaff")} label={t("plans.maxStaff")}>
          <Input
            id={id("maxStaff")}
            name="maxStaff"
            type="number"
            min={0}
            defaultValue={plan.maxStaff}
            dir="ltr"
          />
        </Field>
        <Field id={id("maxMonthlyOrders")} label={t("plans.maxOrders")} className="sm:col-span-2">
          <Input
            id={id("maxMonthlyOrders")}
            name="maxMonthlyOrders"
            type="number"
            min={1}
            defaultValue={plan.maxMonthlyOrders ?? ""}
            dir="ltr"
          />
        </Field>
      </div>
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("plans.save")}
      </Button>
    </form>
  );
}
