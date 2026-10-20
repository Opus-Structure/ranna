import { History, MonitorSpeaker } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { OrderBoard } from "@/components/orders/order-board";
import { ShopToggles } from "@/components/shop-editor/shop-toggles";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";
import { requireMerchant } from "@/lib/auth/guards";
import { merchantAccess } from "@/lib/billing/access";
import { loadBoard } from "@/lib/orders/board";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireMerchant(locale);
  const t = await getTranslations("orders");
  const board = await loadBoard(ctx);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <ShopToggles
              compact
              isOpen={ctx.merchant.isOpen}
              acceptingOrders={ctx.merchant.acceptingOrders}
              canEditOpen={ctx.role === "owner"}
              disabled={!merchantAccess(ctx.merchant).canEdit}
            />
            <Button asChild variant="outline">
              <Link href="/dashboard/orders/history">
                <History className="size-4" aria-hidden />
                {t("history.link")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/screen" target="_blank">
                <MonitorSpeaker className="size-4" aria-hidden />
                {t("screen.link")}
              </Link>
            </Button>
          </>
        }
      />
      <OrderBoard
        shopName={ctx.merchant.name}
        timeZone={ctx.merchant.timezone}
        initial={board}
        canCancel={ctx.role === "owner"}
      />
    </>
  );
}
