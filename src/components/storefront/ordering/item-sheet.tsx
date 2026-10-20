"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { AppLocale } from "@/i18n/routing";
import { pickOptional, pickText } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import { priceLine } from "@/lib/orders/pricing";
import type { TicketLine } from "@/lib/orders/ticket-store";
import type { PublicGroup, PublicItem } from "@/lib/shop/public";
import { assetUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";
import { useShopTheme } from "./shop-theme-context";

/** Bottom sheet for one dish: choices, quantity, a kitchen note, and Add. */
export function ItemSheet({
  item,
  currency,
  canOrder,
  closedLabel,
  onClose,
  onAdd,
}: {
  item: PublicItem | null;
  currency: string;
  canOrder: boolean;
  closedLabel: string;
  onClose: () => void;
  onAdd: (line: Omit<TicketLine, "key">) => void;
}) {
  const theme = useShopTheme();
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        style={theme.style}
        // Opening a dish must not pop the keyboard: without this the browser focuses the first
        // field (the note), the keyboard rises and covers the sheet. Focus the sheet itself.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement)
            e.currentTarget.focus({ preventScroll: true });
        }}
        className={cn(
          theme.fontClass,
          "mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-t-3xl border-0 bg-[var(--shop-ground)] p-0 text-[var(--shop-ink)]",
          "[&>button]:end-3 [&>button]:top-3 [&>button]:grid [&>button]:size-10 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-[var(--shop-card)] [&>button]:opacity-100",
        )}
      >
        {item ? (
          <ItemForm
            key={item.id}
            item={item}
            currency={currency}
            canOrder={canOrder}
            closedLabel={closedLabel}
            onAdd={onAdd}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function groupHint(t: ReturnType<typeof useTranslations<"order">>, g: PublicGroup) {
  if (g.minSelect === 0)
    return g.maxSelect > 1
      ? `${t("optional")} · ${t("chooseUpTo", { count: g.maxSelect })}`
      : t("optional");
  if (g.minSelect === g.maxSelect) return t("choose", { count: g.minSelect });
  return `${t("choose", { count: g.minSelect })} · ${t("chooseUpTo", { count: g.maxSelect })}`;
}

function ItemForm({
  item,
  currency,
  canOrder,
  closedLabel,
  onAdd,
}: {
  item: PublicItem;
  currency: string;
  canOrder: boolean;
  closedLabel: string;
  onAdd: (line: Omit<TicketLine, "key">) => void;
}) {
  const t = useTranslations("order");
  const locale = useLocale() as AppLocale;
  // Preselect the first available option of single-choice required groups (a size, usually).
  const [chosen, setChosen] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const g of item.optionGroups) {
      if (g.minSelect === 1 && g.maxSelect === 1) {
        const first = g.options.find((o) => o.isAvailable);
        if (first) initial.add(first.id);
      }
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const name = pickText(item.name, item.nameI18n, locale);
  const description = pickOptional(item.description, item.descriptionI18n, locale);
  const image = assetUrl(item.imagePath);
  const priced = priceLine(item, [...chosen]);
  const money = (minor: number) => formatMoney(minor, currency, locale);

  function toggle(group: PublicGroup, optionId: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (group.maxSelect === 1) {
        for (const o of group.options) next.delete(o.id);
        next.add(optionId);
        return next;
      }
      if (next.has(optionId)) next.delete(optionId);
      else if (group.options.filter((o) => next.has(o.id)).length < group.maxSelect)
        next.add(optionId);
      return next;
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {image ? (
          <div className="relative aspect-[16/9] w-full bg-[var(--shop-line)]">
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2 px-5 pt-6 pb-4">
          <SheetTitle className="pe-12 text-2xl leading-tight font-bold text-[var(--shop-ink)]">
            {name}
          </SheetTitle>
          {description ? (
            <SheetDescription className="text-ui leading-relaxed text-[var(--shop-muted)]">
              {description}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{name}</SheetDescription>
          )}
          <p className="text-lg font-semibold text-[var(--brand-ink)] tabular-nums">
            {money(item.priceMinor)}
          </p>
        </div>

        {item.optionGroups.map((g) => {
          const multi = g.maxSelect > 1;
          const picked = g.options.filter((o) => chosen.has(o.id)).length;
          return (
            <fieldset key={g.id} className="border-t border-[var(--shop-line)] px-5 py-4">
              <legend className="sr-only">{pickText(g.name, g.nameI18n, locale)}</legend>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span aria-hidden className="text-base font-bold">
                  {pickText(g.name, g.nameI18n, locale)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    g.minSelect > 0 && picked < g.minSelect
                      ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                      : "bg-[var(--shop-line)] text-[var(--shop-muted)]",
                  )}
                >
                  {groupHint(t, g)}
                </span>
              </div>
              <ul className="flex flex-col">
                {g.options.map((o) => {
                  const on = chosen.has(o.id);
                  const full = multi && !on && picked >= g.maxSelect;
                  return (
                    <li key={o.id}>
                      <label
                        className={cn(
                          "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--brand-ink)]",
                          on
                            ? "bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]"
                            : "hover:bg-[var(--shop-line)]/50",
                          (!o.isAvailable || full) && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          type={multi ? "checkbox" : "radio"}
                          name={g.id}
                          checked={on}
                          disabled={!o.isAvailable || full}
                          onChange={() => toggle(g, o.id)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-6 shrink-0 place-items-center border-2 transition-colors",
                            multi ? "rounded-md" : "rounded-full",
                            on
                              ? "border-[var(--brand-ink)] bg-[var(--brand-ink)] text-white"
                              : "border-[var(--shop-muted)]/50",
                          )}
                        >
                          {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                        </span>
                        <span className="flex-1">{pickText(o.name, o.nameI18n, locale)}</span>
                        <span className="text-sm text-[var(--shop-muted)] tabular-nums">
                          {!o.isAvailable
                            ? t("soldOut")
                            : o.priceDeltaMinor
                              ? `+${money(o.priceDeltaMinor)}`
                              : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}

        <div className="border-t border-[var(--shop-line)] px-5 py-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("lineNote")}</span>
            <input
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("lineNotePlaceholder")}
              className="h-12 rounded-xl border border-[var(--shop-line)] bg-[var(--shop-card)] px-3.5 text-base outline-none focus-visible:border-[var(--brand-ink)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ink)]/25"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-[var(--shop-line)] bg-[var(--shop-ground)] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <QuantityStepper value={quantity} onChange={setQuantity} label={t("quantity")} />
        <button
          type="button"
          disabled={!canOrder || !priced.ok}
          onClick={() =>
            onAdd({ itemId: item.id, quantity, optionIds: [...chosen], note: note.trim() || null })
          }
          className={cn(
            "flex h-13 flex-1 items-center justify-center rounded-2xl px-4 text-base font-bold transition-[filter,transform]",
            "bg-[var(--brand)] text-[var(--brand-contrast)] active:scale-[0.98]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
            "disabled:bg-[var(--shop-line)] disabled:text-[var(--shop-muted)]",
          )}
        >
          {!canOrder
            ? closedLabel
            : t("add", {
                price: money((priced.ok ? priced.unitPriceMinor : item.priceMinor) * quantity),
              })}
        </button>
      </div>
    </>
  );
}
