"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveItemAction } from "@/app/(console)/[locale]/dashboard/menu/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISH_PRESETS, type DishPreset } from "@/config/menu-dish-presets";
import type { AppLocale } from "@/i18n/routing";
import { formatMoney, toMinor } from "@/lib/money";

export type TemplateDishesTarget = { categoryId: string; name: string; presetId: string };

/** Lets the owner tick ready-made dishes and add them to a section in one go. */
export function TemplateDishesDialog({
  target,
  onClose,
  currency,
  locales,
  defaultLocale,
  existingNames,
}: {
  target: TemplateDishesTarget | null;
  onClose: () => void;
  currency: string;
  locales: AppLocale[];
  defaultLocale: AppLocale;
  /** Dish names already in the section, so templates already added are not offered twice. */
  existingNames: string[];
}) {
  const t = useTranslations("menu");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setSelected(new Set());
  }

  const dishes: DishPreset[] = (target ? (DISH_PRESETS[target.presetId] ?? []) : []).filter(
    (d) => !Object.values(d.names).some((n) => existingNames.includes(n)),
  );
  const allSelected = dishes.length > 0 && dishes.every((d) => selected.has(d.id));

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function addSelected() {
    if (!target) return;
    const { categoryId } = target;
    const chosen = dishes.filter((d) => selected.has(d.id));
    startTransition(async () => {
      let added = 0;
      try {
        for (const d of chosen) {
          const others = locales.filter((l) => l !== defaultLocale);
          const result = await saveItemAction({
            categoryId,
            name: d.names[defaultLocale],
            nameI18n: Object.fromEntries(others.map((l) => [l, d.names[l]])),
            description: d.descriptions[defaultLocale],
            descriptionI18n: Object.fromEntries(others.map((l) => [l, d.descriptions[l]])),
            price: d.price,
            isAvailable: true,
            optionGroups: [],
          });
          if (!result.ok) {
            const reason = t(`errors.${result.error}` as "errors.generic");
            toast.error(added ? t("presets.partial", { count: added, reason }) : reason);
            if (added) router.refresh();
            return;
          }
          added += 1;
        }
        toast.success(t("presets.added", { count: added }));
        onClose();
        router.refresh();
      } catch {
        toast.error(t("errors.generic"));
        if (added) router.refresh();
      }
    });
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("presets.dialogTitle", { name: target?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("presets.dialogBody")}</DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-3 border-b pb-3 text-sm font-medium">
          <Checkbox
            checked={allSelected}
            disabled={pending || dishes.length === 0}
            onCheckedChange={(v) =>
              setSelected(v === true ? new Set(dishes.map((d) => d.id)) : new Set())
            }
          />
          {t("presets.selectAll")}
        </label>

        <ul className="flex flex-col divide-y">
          {dishes.map((d) => (
            <li key={d.id}>
              <label className="flex cursor-pointer items-start gap-3 py-3">
                <Checkbox
                  className="mt-1"
                  checked={selected.has(d.id)}
                  disabled={pending}
                  onCheckedChange={(v) => toggle(d.id, v === true)}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{d.names[locale]}</span>
                    <span className="shrink-0 text-sm text-muted-foreground" data-numeric>
                      {formatMoney(toMinor(d.price, currency), currency, locale)}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">{d.descriptions[locale]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button disabled={pending || selected.size === 0} onClick={addSelected}>
            {t("presets.addSelected", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
