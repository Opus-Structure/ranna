"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveBrandingAction,
  saveHoursAction,
  saveProfileAction,
  saveSlugAction,
} from "@/app/(console)/[locale]/dashboard/shop/actions";
import type { AppLocale } from "@/i18n/routing";
import type { ShopFont } from "@/lib/branding/theme";
import type { I18nText, OpeningHoursDay, ShopLayout } from "@/lib/db/schema/types";

export type ShopDraft = {
  name: string;
  slug: string;
  phone: string;
  address: string;
  locales: AppLocale[];
  defaultLocale: AppLocale;
  primaryColor: string;
  secondaryColor: string;
  font: ShopFont;
  layout: ShopLayout;
  welcome: I18nText;
  logoPath: string | null;
  coverPath: string | null;
  hours: OpeningHoursDay[];
};

export type FieldErrors = Partial<Record<string, string>>;

type Result = { ok: true } | { ok: false; error: string; field?: string };

/**
 * Draft state shared by the editor tabs, the setup wizard and the live preview. Each section
 * saves its own slice; errors come back as i18n keys under `shopEditor.errors`.
 */
export function useShopDraft(initial: ShopDraft) {
  const t = useTranslations("shopEditor");
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof ShopDraft>(key: K, value: ShopDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function report(result: Result, fallbackField?: string): boolean {
    if (result.ok) return true;
    const field = result.field?.split(".")[0] ?? fallbackField;
    if (field) setErrors((e) => ({ ...e, [field]: result.error }));
    toast.error(t(`errors.${result.error}` as "errors.generic"));
    return false;
  }

  /** Runs saves in order and stops at the first failure. Resolves to true on success. */
  function save(steps: (() => Promise<Result>)[], fallbackField?: string): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          for (const step of steps) {
            if (!report(await step(), fallbackField)) return resolve(false);
          }
          setSaved(draft);
          toast.success(t("saved"));
          router.refresh();
          resolve(true);
        } catch {
          toast.error(t("errors.generic"));
          resolve(false);
        }
      });
    });
  }

  const profileInput = () => ({
    name: draft.name,
    phone: draft.phone,
    address: draft.address,
    defaultLocale: draft.defaultLocale,
    locales: draft.locales,
  });

  return {
    draft,
    update,
    errors,
    pending,
    dirty: JSON.stringify(draft) !== JSON.stringify(saved),
    saveProfile: () =>
      save([
        () => saveProfileAction(profileInput()),
        ...(draft.slug && draft.slug !== saved.slug ? [() => saveSlugAction(draft.slug)] : []),
      ]),
    saveSlugAndName: () =>
      save([() => saveProfileAction(profileInput()), () => saveSlugAction(draft.slug)], "slug"),
    saveLook: () =>
      save([
        () =>
          saveBrandingAction(
            {
              primaryColor: draft.primaryColor,
              secondaryColor: draft.secondaryColor,
              font: draft.font,
              layout: draft.layout,
              welcome: draft.welcome,
            },
            { logoPath: draft.logoPath, coverPath: draft.coverPath },
          ),
      ]),
    saveHours: () =>
      save([() => saveHoursAction(draft.hours), () => saveProfileAction(profileInput())]),
  };
}
