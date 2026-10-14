import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditGate } from "@/components/console/edit-gate";
import { PageHeader } from "@/components/console/page-header";
import { ShopEditor } from "@/components/shop-editor/shop-editor";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/config/brand";
import { initLocale } from "@/i18n/server";
import { requireOwner } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { loadShopEditor } from "@/lib/shop/editor-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shopEditor");
  return { title: t("title") };
}

export default async function ShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireOwner(locale);
  const t = await getTranslations("shopEditor");
  const tc = await getTranslations("console.shell");
  const data = await loadShopEditor(ctx);
  const readOnly = !merchantAccess(ctx.merchant).canEdit;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          data.draft.slug && !readOnly ? (
            <Button asChild variant="outline">
              <a href={`/s/${data.draft.slug}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden />
                {tc("viewShop")}
              </a>
            </Button>
          ) : null
        }
      />
      <EditGate ctx={ctx}>
        <ShopEditor
          initial={data.draft}
          menu={data.menu}
          currency={data.currency}
          origin={appUrl()}
          toggles={data.toggles}
          readOnly={readOnly}
        />
      </EditGate>
    </>
  );
}
