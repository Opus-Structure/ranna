"use client";

import { Languages, Loader2, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveItemAction,
  setItemImageAction,
} from "@/app/(console)/[locale]/dashboard/menu/actions";
import { Field } from "@/components/forms/field";
import { ImageField } from "@/components/shop-editor/image-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { dirFor, type AppLocale } from "@/i18n/routing";
import type { I18nText } from "@/lib/db/schema/types";
import type { MenuCategory, MenuItem } from "@/lib/menu/service";
import { toMajor } from "@/lib/money";

export type ItemSheetTarget =
  { mode: "new"; categoryId: string } | { mode: "edit"; item: MenuItem; categoryId: string };

type OptionDraft = {
  id?: string;
  name: string;
  nameI18n: I18nText;
  priceDelta: string;
  isAvailable: boolean;
};
type GroupDraft = {
  id?: string;
  name: string;
  nameI18n: I18nText;
  minSelect: string;
  maxSelect: string;
  options: OptionDraft[];
};
type ItemDraft = {
  id?: string;
  categoryId: string;
  name: string;
  nameI18n: I18nText;
  description: string;
  descriptionI18n: I18nText;
  price: string;
  isAvailable: boolean;
  imagePath: string | null;
  groups: GroupDraft[];
};

const languageNames: Record<AppLocale, string> = { ar: "العربية", fr: "Français", en: "English" };
const num = (v: string) => Number(v.replace(",", ".").trim());

function toDraft(target: ItemSheetTarget, currency: string): ItemDraft {
  if (target.mode === "new") {
    return {
      categoryId: target.categoryId,
      name: "",
      nameI18n: {},
      description: "",
      descriptionI18n: {},
      price: "",
      isAvailable: true,
      imagePath: null,
      groups: [],
    };
  }
  const i = target.item;
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    nameI18n: i.nameI18n,
    description: i.description ?? "",
    descriptionI18n: i.descriptionI18n,
    price: String(toMajor(i.priceMinor, currency)),
    isAvailable: i.isAvailable,
    imagePath: i.imagePath,
    groups: i.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      nameI18n: g.nameI18n,
      minSelect: String(g.minSelect),
      maxSelect: String(g.maxSelect),
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        nameI18n: o.nameI18n,
        priceDelta: String(toMajor(o.priceDeltaMinor, currency)),
        isAvailable: o.isAvailable,
      })),
    })),
  };
}

export function ItemSheet({
  target,
  onClose,
  categories,
  currency,
  locales,
  defaultLocale,
}: {
  target: ItemSheetTarget | null;
  onClose: () => void;
  categories: MenuCategory[];
  currency: string;
  locales: AppLocale[];
  defaultLocale: AppLocale;
}) {
  const t = useTranslations("menu.item");
  const locale = useLocale();
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={dirFor(locale) === "rtl" ? "left" : "right"}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="font-display text-xl">
            {target?.mode === "edit" ? t("editTitle") : t("newTitle")}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("groupsHint")}</SheetDescription>
        </SheetHeader>
        {target ? (
          <ItemForm
            key={target.mode === "edit" ? target.item.id : `new-${target.categoryId}`}
            target={target}
            categories={categories}
            currency={currency}
            otherLocales={locales.filter((l) => l !== defaultLocale)}
            onSaved={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ItemForm({
  target,
  categories,
  currency,
  otherLocales,
  onSaved,
}: {
  target: ItemSheetTarget;
  categories: MenuCategory[];
  currency: string;
  otherLocales: AppLocale[];
  onSaved: () => void;
}) {
  const t = useTranslations("menu");
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(target, currency));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const setGroup = (gi: number, patch: Partial<GroupDraft>) =>
    set(
      "groups",
      draft.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)),
    );
  const setOption = (gi: number, oi: number, patch: Partial<OptionDraft>) =>
    setGroup(gi, {
      options: draft.groups[gi]!.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
    });

  function save() {
    startTransition(async () => {
      try {
        const result = await saveItemAction({
          id: draft.id,
          categoryId: draft.categoryId,
          name: draft.name,
          nameI18n: draft.nameI18n,
          description: draft.description,
          descriptionI18n: draft.descriptionI18n,
          price: num(draft.price),
          isAvailable: draft.isAvailable,
          optionGroups: draft.groups.map((g) => ({
            id: g.id,
            name: g.name,
            nameI18n: g.nameI18n,
            minSelect: num(g.minSelect),
            maxSelect: num(g.maxSelect),
            options: g.options.map((o) => ({
              id: o.id,
              name: o.name,
              nameI18n: o.nameI18n,
              priceDelta: num(o.priceDelta || "0"),
              isAvailable: o.isAvailable,
            })),
          })),
        });
        if (!result.ok) {
          const field = result.field?.split(".")[0] ?? "form";
          setErrors({ [field === "optionGroups" ? "groups" : field]: result.error });
          toast.error(t(`errors.${result.error}` as "errors.generic"));
          return;
        }
        const id = result.data?.id ?? draft.id;
        const originalImage = target.mode === "edit" ? target.item.imagePath : null;
        if (id && draft.imagePath !== originalImage) {
          const image = await setItemImageAction(id, draft.imagePath);
          if (!image.ok) toast.error(t(`errors.${image.error}` as "errors.generic"));
        }
        router.refresh();
        onSaved();
      } catch {
        toast.error(t("errors.generic"));
      }
    });
  }

  const err = (k: string) => (errors[k] ? t(`errors.${errors[k]}` as "errors.generic") : undefined);

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        <Field id="item-section" label={t("item.section")}>
          <select
            id="item-section"
            value={draft.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className="h-11 rounded-md border border-input bg-card px-3 focus-visible:outline-ring"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="item-name" label={t("item.name")} error={err("name")}>
          <Input
            id="item-name"
            value={draft.name}
            maxLength={80}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={Boolean(errors.name) || undefined}
            className="h-11"
          />
        </Field>

        <Field id="item-description" label={t("item.description")} error={err("description")}>
          <Textarea
            id="item-description"
            value={draft.description}
            maxLength={300}
            rows={3}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        {otherLocales.length ? (
          <details className="group rounded-xl border p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <Languages className="size-4" aria-hidden />
              {t("item.translations")}
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              {otherLocales.map((l) => (
                <div key={l} className="flex flex-col gap-2" lang={l} dir={dirFor(l)}>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {languageNames[l]}
                  </span>
                  <Input
                    value={draft.nameI18n[l] ?? ""}
                    maxLength={80}
                    placeholder={t("item.name")}
                    aria-label={`${t("item.name")} · ${languageNames[l]}`}
                    onChange={(e) => set("nameI18n", { ...draft.nameI18n, [l]: e.target.value })}
                  />
                  <Textarea
                    value={draft.descriptionI18n[l] ?? ""}
                    maxLength={300}
                    rows={2}
                    placeholder={t("item.description")}
                    aria-label={`${t("item.description")} · ${languageNames[l]}`}
                    onChange={(e) =>
                      set("descriptionI18n", { ...draft.descriptionI18n, [l]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="item-price" label={t("item.price", { currency })} error={err("price")}>
            <Input
              id="item-price"
              inputMode="decimal"
              dir="ltr"
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
              aria-invalid={Boolean(errors.price) || undefined}
              className="h-11"
            />
          </Field>
          <label className="flex items-center justify-between gap-3 self-end rounded-lg border px-4 py-2.5">
            <span className="text-sm font-medium">
              {draft.isAvailable ? t("item.available") : t("item.soldOut")}
            </span>
            <Switch checked={draft.isAvailable} onCheckedChange={(v) => set("isAvailable", v)} />
          </label>
        </div>

        <ImageField
          kind="item"
          label={t("item.image")}
          path={draft.imagePath}
          onChange={(p) => set("imagePath", p)}
        />

        <section aria-labelledby="item-groups" className="flex flex-col gap-4">
          <div>
            <h3 id="item-groups" className="font-semibold">
              {t("item.groups")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("item.groupsHint")}</p>
          </div>
          {errors.groups ? (
            <p className="text-sm font-medium text-destructive">{err("groups")}</p>
          ) : null}
          {draft.groups.map((g, gi) => (
            <fieldset key={g.id ?? `g-${gi}`} className="flex flex-col gap-3 rounded-xl border p-4">
              <legend className="sr-only">{g.name || t("item.groupName")}</legend>
              <div className="flex gap-2">
                <Input
                  value={g.name}
                  maxLength={60}
                  placeholder={t("item.groupName")}
                  aria-label={t("item.groupName")}
                  onChange={(e) => setGroup(gi, { name: e.target.value })}
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("item.removeGroup")}
                  onClick={() =>
                    set(
                      "groups",
                      draft.groups.filter((_, i) => i !== gi),
                    )
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  {t("item.minSelect")}
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    dir="ltr"
                    value={g.minSelect}
                    onChange={(e) => setGroup(gi, { minSelect: e.target.value })}
                    className="h-9 w-16"
                  />
                </label>
                <label className="flex items-center gap-2">
                  {t("item.maxSelect")}
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    dir="ltr"
                    value={g.maxSelect}
                    onChange={(e) => setGroup(gi, { maxSelect: e.target.value })}
                    className="h-9 w-16"
                  />
                </label>
              </div>
              <ul className="flex flex-col gap-2">
                {g.options.map((o, oi) => (
                  <li key={o.id ?? `o-${oi}`} className="flex items-center gap-2">
                    <Input
                      value={o.name}
                      maxLength={60}
                      placeholder={t("item.optionName")}
                      aria-label={t("item.optionName")}
                      onChange={(e) => setOption(gi, oi, { name: e.target.value })}
                      className="h-10 min-w-0 flex-1"
                    />
                    <Input
                      inputMode="decimal"
                      dir="ltr"
                      value={o.priceDelta}
                      placeholder="+0"
                      aria-label={t("item.priceDelta")}
                      onChange={(e) => setOption(gi, oi, { priceDelta: e.target.value })}
                      className="h-10 w-24"
                    />
                    <Switch
                      checked={o.isAvailable}
                      onCheckedChange={(v) => setOption(gi, oi, { isAvailable: v })}
                      aria-label={t("item.available")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("item.removeOption")}
                      onClick={() =>
                        setGroup(gi, { options: g.options.filter((_, i) => i !== oi) })
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  setGroup(gi, {
                    options: [
                      ...g.options,
                      { name: "", nameI18n: {}, priceDelta: "0", isAvailable: true },
                    ],
                  })
                }
              >
                <Plus aria-hidden />
                {t("item.addOption")}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              set("groups", [
                ...draft.groups,
                {
                  name: "",
                  nameI18n: {},
                  minSelect: "1",
                  maxSelect: "1",
                  options: [{ name: "", nameI18n: {}, priceDelta: "0", isAvailable: true }],
                },
              ])
            }
          >
            <Plus aria-hidden />
            {t("item.addGroup")}
          </Button>
        </section>
      </div>
      <div className="border-t px-6 py-4">
        <Button
          size="lg"
          className="h-12 w-full sm:w-auto sm:px-8"
          disabled={pending}
          onClick={save}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("item.save")}
        </Button>
      </div>
    </>
  );
}
