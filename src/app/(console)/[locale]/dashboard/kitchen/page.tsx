import { Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/console/page-header";
import { KitchenScreen } from "@/components/orders/kitchen-screen";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";
import { requireScreen } from "@/lib/auth/guards";
import { loadBoard } from "@/lib/orders/board";
import { routesToScreen } from "@/lib/orders/kitchen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders.kitchen");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Kitchen display for a second tablet. Orders-only, so staff may open it. */
export default async function KitchenPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireScreen(locale, "kitchen");
  const t = await getTranslations("orders.kitchen");
  const board = await loadBoard(ctx);
  const on = routesToScreen(board.kitchen.routing);

  return (
    <>
      <PageHeader title={t("title")} description={on ? t("description") : undefined} />
      {on ? (
        <KitchenScreen shopName={ctx.merchant.name} initial={board} />
      ) : (
        <div className="flex max-w-xl flex-col items-start gap-4 rounded-xl border border-dashed p-6">
          <p className="font-display text-xl font-semibold">{t("offTitle")}</p>
          <p className="text-muted-foreground">
            {ctx.role === "owner" ? t("offOwner") : t("offStaff")}
          </p>
          {ctx.role === "owner" ? (
            <Button asChild>
              <Link href="/dashboard/settings">
                <Settings2 className="size-4" aria-hidden />
                {t("openSettings")}
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
