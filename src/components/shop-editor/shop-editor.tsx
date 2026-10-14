"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PublicCategory } from "@/lib/shop/public";
import { PhonePreview } from "./phone-preview";
import {
  ContactFields,
  HoursFields,
  LanguageFields,
  LookFields,
  NameAndLinkFields,
} from "./sections";
import { ShopToggles } from "./shop-toggles";
import { useShopDraft, type ShopDraft } from "./use-shop-draft";

export function ShopEditor({
  initial,
  menu,
  currency,
  origin,
  toggles,
  readOnly,
}: {
  initial: ShopDraft;
  menu: PublicCategory[];
  currency: string;
  origin: string;
  toggles: { isOpen: boolean; acceptingOrders: boolean };
  readOnly: boolean;
}) {
  const t = useTranslations("shopEditor");
  const locale = useLocale();
  const s = useShopDraft(initial);
  const props = { draft: s.draft, update: s.update, errors: s.errors };

  const save = (onClick: () => Promise<boolean>) => (
    <Button
      size="lg"
      className="h-11 self-start px-6"
      disabled={s.pending || readOnly}
      onClick={() => void onClick()}
    >
      {s.pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {t("save")}
    </Button>
  );

  const panel = (children: ReactNode) => <div className="flex flex-col gap-8 pt-6">{children}</div>;

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Tabs defaultValue="profile" className="min-w-0">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="look">{t("tabs.look")}</TabsTrigger>
          <TabsTrigger value="hours">{t("tabs.hours")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          {panel(
            <>
              <NameAndLinkFields {...props} origin={origin} />
              <ContactFields {...props} />
              <LanguageFields {...props} />
              {save(s.saveProfile)}
            </>,
          )}
        </TabsContent>
        <TabsContent value="look">
          {panel(
            <>
              <LookFields {...props} />
              {save(s.saveLook)}
            </>,
          )}
        </TabsContent>
        <TabsContent value="hours">
          {panel(
            <>
              <ShopToggles {...toggles} canEditOpen disabled={readOnly} />
              <HoursFields {...props} />
              {save(s.saveHours)}
            </>,
          )}
        </TabsContent>
      </Tabs>
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <PhonePreview draft={s.draft} menu={menu} currency={currency} locale={locale} />
      </aside>
    </div>
  );
}
