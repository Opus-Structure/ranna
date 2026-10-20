"use client";

import { ChevronRight, Loader2, Trash2, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { unlockAlarm } from "@/lib/orders/alerts";
import { placeOrderAction } from "@/app/(site)/[locale]/s/[slug]/actions";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pickText } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import { indexMenu, priceLine } from "@/lib/orders/pricing";
import { rememberOrder, useRecentOrders, useTicket } from "@/lib/orders/ticket-store";
import type { PublicCategory } from "@/lib/shop/public";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";
import { useShopTheme } from "./shop-theme-context";

const RECENT_MS = 12 * 3600_000;
const CUSTOMER_KEY = "ranna:customer-name";

type Field = "name" | "phone" | "note";
/** Server error codes that belong to one field rather than to the whole order. */
const fieldOf: Partial<Record<string, Field>> = {
  nameRequired: "name",
  nameTooLong: "name",
  phone: "phone",
  noteTooLong: "note",
};
const inputClass =
  "h-12 rounded-xl border border-[var(--shop-line)] bg-[var(--shop-card)] px-3.5 text-base outline-none focus-visible:border-[var(--brand-ink)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ink)]/25 aria-invalid:border-[#8a1f12]";

/**
 * The ticket: docked at the bottom while the customer browses (the screen's one brand plate),
 * opening into a review sheet that names and places the order.
 */
export function Ticket({
  slug,
  menu,
  currency,
  canOrder,
  closedLabel,
  askPhone,
  table,
}: {
  slug: string;
  menu: PublicCategory[];
  currency: string;
  canOrder: boolean;
  closedLabel: string;
  askPhone: boolean;
  table: { code: string; label: string } | null;
}) {
  const t = useTranslations("order");
  const locale = useLocale() as AppLocale;
  const theme = useShopTheme();
  const router = useRouter();
  const ticket = useTicket(slug);
  const recent = useRecentOrders().find(
    (o) => o.slug === slug && Date.now() - Date.parse(o.placedAt) < RECENT_MS,
  );
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: Field; message: string } | null>(null);
  const requestId = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const items = indexMenu(menu);
  const money = (minor: number) => formatMoney(minor, currency, locale);

  const priced = ticket.lines.map((line) => {
    const item = items.get(line.itemId);
    const p = item ? priceLine(item, line.optionIds) : null;
    return {
      line,
      item,
      unit: p?.ok ? p.unitPriceMinor : 0,
      options: p?.ok ? p.options : [],
      valid: Boolean(item?.isAvailable && p?.ok),
    };
  });
  const count = ticket.lines.reduce((s, l) => s + l.quantity, 0);
  const total = priced.reduce((s, p) => s + p.unit * p.line.quantity, 0);

  // Drop lines whose dish no longer exists on the menu (deleted since the last visit).
  useEffect(() => {
    if (ticket.lines.some((l) => !items.has(l.itemId))) {
      ticket.lines.filter((l) => !items.has(l.itemId)).forEach((l) => ticket.remove(l.key));
    }
  }, [ticket, items]);

  /** Field problems sit under their field (and take focus); the rest go in the alert, scrolled into view. */
  function showError(code: string, message: string) {
    const field = fieldOf[code];
    if (field) {
      setFieldError({ field, message });
      (formRef.current?.elements.namedItem(field) as HTMLElement | null)?.focus();
      return;
    }
    setError(message);
    requestAnimationFrame(() =>
      alertRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }

  const describedBy = (field: Field, hint?: string) =>
    [hint, fieldError?.field === field ? `${field}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;
  const fieldMessage = (field: Field) =>
    fieldError?.field === field ? (
      <span id={`${field}-error`} className="text-sm font-semibold text-shop-error">
        {fieldError.message}
      </span>
    ) : null;
  const clearFieldError = (field: Field) => fieldError?.field === field && setFieldError(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placing) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    setError(null);
    setFieldError(null);
    if (!name.trim()) return showError("nameRequired", t("errors.nameRequired"));
    try {
      localStorage.setItem(CUSTOMER_KEY, name.trim());
    } catch {
      // Not essential.
    }
    // One id per attempt, kept across retries so a resend never creates a second order.
    requestId.current ??= crypto.randomUUID();
    // This tap is the user gesture browsers require before a page may make sound; the order page
    // is a soft navigation away, so the unlocked audio context carries over to the ring.
    void unlockAlarm();
    setPlacing(true);
    try {
      const result = await placeOrderAction({
        slug,
        clientRequestId: requestId.current,
        customerName: name,
        phone: String(form.get("phone") ?? ""),
        note: String(form.get("note") ?? ""),
        table: table?.code,
        locale,
        website: String(form.get("website") ?? ""),
        lines: ticket.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          optionIds: l.optionIds,
          note: l.note ?? undefined,
        })),
      });
      if (result.ok) {
        rememberOrder({
          token: result.token,
          slug,
          number: result.number,
          placedAt: new Date().toISOString(),
        });
        requestId.current = null;
        ticket.clear();
        router.push(`/o/${result.token}`);
        return;
      }
      const item = result.itemId ? items.get(result.itemId) : undefined;
      showError(
        result.error,
        t(`errors.${result.error}` as "errors.generic", {
          item: item ? pickText(item.name, item.nameI18n, locale) : "",
        }),
      );
      setPlacing(false);
    } catch {
      showError("network", navigator.onLine ? t("errors.generic") : t("errors.network"));
      setPlacing(false);
    }
  }

  const savedName =
    typeof window === "undefined"
      ? ""
      : (() => {
          try {
            return localStorage.getItem(CUSTOMER_KEY) ?? "";
          } catch {
            return "";
          }
        })();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
          {recent ? (
            <Link
              href={`/o/${recent.token}`}
              className="flex items-center justify-between self-center rounded-full bg-[var(--shop-ink)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgb(0_0_0/0.6)]"
            >
              {t("recent", { number: recent.number })}
              <ChevronRight className="ms-2 size-4 rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
          {count > 0 ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative flex h-15 items-center gap-3 overflow-hidden rounded-2xl bg-[var(--brand)] px-5 text-[var(--brand-contrast)] shadow-[0_14px_30px_-14px_rgb(0_0_0/0.55)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)] active:scale-[0.99]"
            >
              {/* The ticket's perforated top edge: the platform's lattice band. */}
              <span aria-hidden className="absolute inset-x-3 top-1.5 band-rule opacity-40" />
              <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-contrast)_18%,transparent)] px-2.5 py-0.5 text-sm font-bold tabular-nums">
                {t("ticket.items", { count })}
              </span>
              <span className="flex-1 text-start text-base font-bold">{t("ticket.review")}</span>
              <span className="text-base font-bold tabular-nums">{money(total)}</span>
            </button>
          ) : !canOrder ? (
            <p className="self-center rounded-full bg-[var(--shop-ink)] px-4 py-2 text-sm font-semibold text-white">
              {closedLabel}
            </p>
          ) : null}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          style={theme.style}
          className={cn(
            theme.fontClass,
            "mx-auto flex max-h-[94dvh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-t-3xl border-0 bg-[var(--shop-ground)] p-0 text-[var(--shop-ink)]",
            // A filled close button, so lines scrolling beneath it (the keyboard shortens the sheet) stay legible.
            "[&>button]:end-3 [&>button]:top-3 [&>button]:grid [&>button]:size-10 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-[var(--shop-card)] [&>button]:opacity-100",
          )}
        >
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
            {/* Stops short of the sheet's close button. */}
            <span aria-hidden className="me-10 mb-4 block band-rule text-[var(--brand-ink)]" />
            <SheetTitle className="text-2xl font-bold text-[var(--shop-ink)]">
              {t("ticket.title")}
            </SheetTitle>
            <SheetDescription className="mt-1 flex items-center gap-2 text-sm text-[var(--shop-muted)]">
              <Wallet className="size-4" aria-hidden />
              {t("ticket.payAtCounter")}
            </SheetDescription>
            {table ? (
              <p className="mt-3 inline-flex rounded-full bg-[var(--brand-2)] px-3 py-1 text-sm font-bold text-[var(--brand-2-contrast)]">
                {t("ticket.table", { label: table.label })}
              </p>
            ) : null}

            {ticket.lines.length === 0 ? (
              <p className="py-10 text-center text-[var(--shop-muted)]">{t("ticket.empty")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--shop-line)] border-y border-[var(--shop-line)]">
                {priced.map(({ line, item, unit, options, valid }) => {
                  const name = item ? pickText(item.name, item.nameI18n, locale) : "—";
                  return (
                    <li
                      key={line.key}
                      className={cn("flex flex-col gap-2 py-4", !valid && "opacity-60")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{name}</p>
                          {options.length ? (
                            <p className="text-sm text-[var(--shop-muted)]">
                              {options
                                .map((o) => {
                                  const opt = item?.optionGroups
                                    .flatMap((g) => g.options)
                                    .find((x) => x.name === o.optionName);
                                  return opt
                                    ? pickText(opt.name, opt.nameI18n, locale)
                                    : o.optionName;
                                })
                                .join(" · ")}
                            </p>
                          ) : null}
                          {line.note ? (
                            <p className="text-sm text-[var(--shop-muted)] italic">“{line.note}”</p>
                          ) : null}
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">
                          {money(unit * line.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          min={0}
                          onChange={(q) => ticket.setQuantity(line.key, q)}
                          label={`${t("quantity")} · ${name}`}
                        />
                        <button
                          type="button"
                          onClick={() => ticket.remove(line.key)}
                          aria-label={t("ticket.remove", { name })}
                          className="grid size-11 place-items-center rounded-full text-[var(--shop-muted)] hover:bg-[var(--shop-line)] focus-visible:outline-2 focus-visible:outline-[var(--brand-ink)]"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 flex items-baseline justify-between text-lg font-bold">
              <span>{t("ticket.total")}</span>
              <span className="tabular-nums">{money(total)}</span>
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 text-sm font-semibold text-[var(--brand-ink)] underline-offset-4 hover:underline"
            >
              {t("ticket.continue")}
            </button>

            {ticket.lines.length ? (
              <form
                ref={formRef}
                id="checkout"
                onSubmit={submit}
                className="mt-6 flex flex-col gap-4"
                noValidate
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{t("checkout.name")}</span>
                  <input
                    name="name"
                    required
                    maxLength={40}
                    autoComplete="given-name"
                    defaultValue={savedName}
                    aria-invalid={fieldError?.field === "name" || undefined}
                    aria-describedby={describedBy("name", "name-hint")}
                    onInput={() => clearFieldError("name")}
                    className={inputClass}
                  />
                  {fieldMessage("name")}
                  <span id="name-hint" className="text-sm text-[var(--shop-muted)]">
                    {t("checkout.nameHint")}
                  </span>
                </label>
                {askPhone ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">{t("checkout.phone")}</span>
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={20}
                      dir="ltr"
                      aria-invalid={fieldError?.field === "phone" || undefined}
                      aria-describedby={describedBy("phone", "phone-hint")}
                      onInput={() => clearFieldError("phone")}
                      className={cn(inputClass, "rtl:text-end")}
                    />
                    {fieldMessage("phone")}
                    <span id="phone-hint" className="text-sm text-[var(--shop-muted)]">
                      {t("checkout.phoneHint")}
                    </span>
                  </label>
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{t("checkout.note")}</span>
                  <textarea
                    name="note"
                    rows={2}
                    maxLength={300}
                    aria-invalid={fieldError?.field === "note" || undefined}
                    aria-describedby={describedBy("note")}
                    onInput={() => clearFieldError("note")}
                    className={cn(inputClass, "h-auto py-2.5")}
                  />
                  {fieldMessage("note")}
                </label>
                {/* Honeypot: invisible to people and screen readers, tempting to form-filling bots. */}
                <div aria-hidden className="absolute -start-[10000px] h-px w-px overflow-hidden">
                  <label>
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                {error ? (
                  <p
                    ref={alertRef}
                    role="alert"
                    className="rounded-xl bg-shop-error-wash px-4 py-3 text-sm font-semibold text-shop-error"
                  >
                    {error}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
          {ticket.lines.length ? (
            <div className="border-t border-[var(--shop-line)] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="submit"
                form="checkout"
                disabled={placing || !canOrder || priced.some((p) => !p.valid)}
                className={cn(
                  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-transform active:scale-[0.99]",
                  "bg-[var(--brand)] text-[var(--brand-contrast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
                  "disabled:bg-[var(--shop-line)] disabled:text-[var(--shop-muted)]",
                )}
              >
                {placing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {!canOrder
                  ? closedLabel
                  : placing
                    ? t("checkout.placing")
                    : t("checkout.place", { total: money(total) })}
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
