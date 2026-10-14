"use client";

import { AlertTriangle, LayoutGrid, List, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { shopFontClass } from "@/app/shop-fonts";
import { describedBy, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { intlLocale } from "@/i18n/format";
import { locales, type AppLocale } from "@/i18n/routing";
import { SHOP_FONT_LABELS, SHOP_FONTS, shopTheme } from "@/lib/branding/theme";
import { suggestSlug, validateSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { ColorField } from "./color-field";
import { ImageField } from "./image-field";
import type { FieldErrors, ShopDraft } from "./use-shop-draft";

type SectionProps = {
  draft: ShopDraft;
  update: <K extends keyof ShopDraft>(key: K, value: ShopDraft[K]) => void;
  errors: FieldErrors;
};

const languageNames: Record<AppLocale, string> = { ar: "العربية", fr: "Français", en: "English" };

function useErrorText() {
  const t = useTranslations("shopEditor.errors");
  return (key?: string) => (key ? t(key as "generic") : undefined);
}

export function NameAndLinkFields({
  draft,
  update,
  errors,
  origin,
}: SectionProps & { origin: string }) {
  const t = useTranslations("shopEditor.fields");
  const err = useErrorText();
  const slugCheck = draft.slug ? validateSlug(draft.slug) : null;
  const slugError =
    errors.slug ?? (slugCheck && !slugCheck.ok ? `slug_${slugCheck.problem}` : undefined);
  return (
    <div className="flex flex-col gap-5">
      <Field id="shop-name" label={t("name")} error={err(errors.name)}>
        <Input
          id="shop-name"
          value={draft.name}
          maxLength={80}
          onChange={(e) => update("name", e.target.value)}
          aria-invalid={Boolean(errors.name) || undefined}
          className="h-11"
        />
      </Field>
      <Field id="shop-slug" label={t("slug")} hint={t("slugHint")} error={err(slugError)}>
        <div className="flex items-stretch gap-2">
          <div
            dir="ltr"
            className="flex h-11 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-input bg-card focus-within:outline-2 focus-within:outline-ring"
          >
            <span className="flex h-full shrink-0 items-center bg-muted px-3 text-sm text-muted-foreground">
              {origin.replace(/^https?:\/\//, "")}/s/
            </span>
            <input
              id="shop-slug"
              value={draft.slug}
              maxLength={40}
              spellCheck={false}
              autoCapitalize="none"
              onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              aria-invalid={Boolean(slugError) || undefined}
              aria-describedby={describedBy("shop-slug", { error: slugError, hint: true })}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            />
          </div>
          {!draft.slug ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() =>
                update("slug", suggestSlug(draft.name, Math.random().toString(36).slice(2)))
              }
            >
              <Wand2 aria-hidden />
              <span className="sr-only">{t("suggestSlug")}</span>
            </Button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}

export function ContactFields({ draft, update, errors }: SectionProps) {
  const t = useTranslations("shopEditor.fields");
  const err = useErrorText();
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id="shop-phone" label={t("phone")} error={err(errors.phone)}>
        <Input
          id="shop-phone"
          type="tel"
          dir="ltr"
          inputMode="tel"
          value={draft.phone}
          maxLength={20}
          onChange={(e) => update("phone", e.target.value)}
          aria-invalid={Boolean(errors.phone) || undefined}
          className="h-11 rtl:text-end"
        />
      </Field>
      <Field id="shop-address" label={t("address")} error={err(errors.address)}>
        <Input
          id="shop-address"
          value={draft.address}
          maxLength={160}
          onChange={(e) => update("address", e.target.value)}
          className="h-11"
        />
      </Field>
    </div>
  );
}

export function LanguageFields({ draft, update, errors }: SectionProps) {
  const t = useTranslations("shopEditor.fields");
  const err = useErrorText();
  const toggle = (l: AppLocale, on: boolean) => {
    const next = on
      ? Array.from(new Set([...draft.locales, l]))
      : draft.locales.filter((x) => x !== l);
    update("locales", next);
    if (!next.includes(draft.defaultLocale) && next[0]) update("defaultLocale", next[0]);
  };
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("languages")}</legend>
        <p className="text-sm text-muted-foreground">{t("languagesHint")}</p>
        <div className="flex flex-wrap gap-3">
          {locales.map((l) => (
            <label
              key={l}
              className="flex h-11 items-center gap-2.5 rounded-lg border px-4 has-[:checked]:border-primary"
            >
              <Checkbox
                checked={draft.locales.includes(l)}
                onCheckedChange={(v) => toggle(l, v === true)}
              />
              <span lang={l}>{languageNames[l]}</span>
            </label>
          ))}
        </div>
        {errors.locales ? (
          <p className="text-sm font-medium text-destructive">{err(errors.locales)}</p>
        ) : null}
      </fieldset>
      <Field
        id="shop-default-locale"
        label={t("defaultLanguage")}
        error={err(errors.defaultLocale)}
      >
        <select
          id="shop-default-locale"
          value={draft.defaultLocale}
          onChange={(e) => update("defaultLocale", e.target.value as AppLocale)}
          className="h-11 rounded-md border border-input bg-card px-3 focus-visible:outline-ring"
        >
          {draft.locales.map((l) => (
            <option key={l} value={l} lang={l}>
              {languageNames[l]}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function LookFields({ draft, update, errors }: SectionProps) {
  const t = useTranslations("shopEditor");
  const err = useErrorText();
  const theme = shopTheme({
    primaryColor: draft.primaryColor,
    secondaryColor: draft.secondaryColor,
  });
  return (
    <div className="flex flex-col gap-7">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <ImageField
          kind="logo"
          shape="circle"
          label={t("fields.logo")}
          hint={t("fields.logoHint")}
          path={draft.logoPath}
          onChange={(p) => update("logoPath", p)}
        />
        <ImageField
          kind="cover"
          shape="wide"
          label={t("fields.cover")}
          hint={t("fields.coverHint")}
          path={draft.coverPath}
          onChange={(p) => update("coverPath", p)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ColorField
          label={t("fields.primaryColor")}
          value={draft.primaryColor}
          onChange={(v) => update("primaryColor", v)}
          error={err(errors.primaryColor)}
        />
        <ColorField
          label={t("fields.secondaryColor")}
          value={draft.secondaryColor}
          onChange={(v) => update("secondaryColor", v)}
          error={err(errors.secondaryColor)}
        />
      </div>
      {theme.warnings.length ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {theme.warnings.map((w) => (
            <li
              key={`${w.kind}-${w.color}`}
              className="flex items-start gap-2.5 rounded-lg bg-state-preparing/16 px-3.5 py-2.5 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t(`contrast.${w.kind}`, {
                color: t(`contrast.${w.color}`),
                ratio: w.ratio.toFixed(1),
              })}
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("fields.font")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHOP_FONTS.map((f) => (
            <label
              key={f}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                draft.font === f ? "border-primary bg-primary/6" : "hover:bg-accent/60",
              )}
            >
              <input
                type="radio"
                name="shop-font"
                value={f}
                checked={draft.font === f}
                onChange={() => update("font", f)}
                className="sr-only"
              />
              <span className={cn(shopFontClass[f], "text-xl leading-tight")} aria-hidden>
                أبجد Aa
              </span>
              <span className="text-xs text-muted-foreground">{SHOP_FONT_LABELS[f]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("fields.layout")}</legend>
        <div className="grid max-w-sm grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["list", "grid"] as const).map((l) => (
            <label
              key={l}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                draft.layout === l
                  ? "bg-card shadow-[0_1px_2px_oklch(0.235_0.018_40/0.12)]"
                  : "text-muted-foreground",
              )}
            >
              <input
                type="radio"
                name="shop-layout"
                value={l}
                checked={draft.layout === l}
                onChange={() => update("layout", l)}
                className="sr-only"
              />
              {l === "list" ? (
                <List className="size-4" aria-hidden />
              ) : (
                <LayoutGrid className="size-4" aria-hidden />
              )}
              {l === "list" ? t("fields.layoutList") : t("fields.layoutGrid")}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("fields.welcome")}</legend>
        <p className="text-sm text-muted-foreground">{t("fields.welcomeHint")}</p>
        {draft.locales.map((l) => (
          <Textarea
            key={l}
            lang={l}
            dir={l === "ar" ? "rtl" : "ltr"}
            rows={2}
            maxLength={160}
            value={draft.welcome[l] ?? ""}
            onChange={(e) => update("welcome", { ...draft.welcome, [l]: e.target.value })}
            aria-label={`${t("fields.welcome")} · ${languageNames[l]}`}
            placeholder={languageNames[l]}
          />
        ))}
        {errors.welcome ? (
          <p className="text-sm font-medium text-destructive">{err(errors.welcome)}</p>
        ) : null}
      </fieldset>
    </div>
  );
}

export function HoursFields({ draft, update, errors }: SectionProps) {
  const t = useTranslations("shopEditor.fields");
  const err = useErrorText();
  const locale = useLocale() as AppLocale;
  const dayName = (day: number) =>
    new Intl.DateTimeFormat(intlLocale[locale], { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 0, 4 + day)),
    );
  // Week starts on Saturday in Algeria (weekend Fri–Sat); show Sat → Fri.
  const order = [6, 0, 1, 2, 3, 4, 5];
  const setDay = (day: number, patch: Partial<ShopDraft["hours"][number]>) =>
    update(
      "hours",
      draft.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    );
  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{t("opens")}</legend>
      <div className="divide-y rounded-xl border">
        {order.map((day) => {
          const h = draft.hours.find((x) => x.day === day)!;
          return (
            <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="w-28 font-medium">{dayName(day)}</span>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={h.closed}
                  onCheckedChange={(v) => setDay(day, { closed: v === true })}
                />
                {t("closedDay")}
              </label>
              <div className={cn("ms-auto flex items-center gap-2", h.closed && "invisible")}>
                <Input
                  type="time"
                  value={h.open}
                  onChange={(e) => setDay(day, { open: e.target.value })}
                  aria-label={`${dayName(day)} · ${t("opens")}`}
                  className="h-10 w-28"
                  dir="ltr"
                />
                <span aria-hidden className="text-muted-foreground">
                  –
                </span>
                <Input
                  type="time"
                  value={h.close}
                  onChange={(e) => setDay(day, { close: e.target.value })}
                  aria-label={`${dayName(day)} · ${t("closes")}`}
                  className="h-10 w-28"
                  dir="ltr"
                />
              </div>
            </div>
          );
        })}
      </div>
      {errors.hours ? (
        <p className="mt-2 text-sm font-medium text-destructive">{err(errors.hours)}</p>
      ) : null}
    </fieldset>
  );
}
