import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CalloutScreen } from "@/components/orders/callout-screen";
import { initLocale } from "@/i18n/server";
import { requireMerchant } from "@/lib/auth/guards";
import { loadBoard } from "@/lib/orders/board";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders.screen");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Full-screen call-out display for a screen customers can see. Outside the console frame. */
export default async function ScreenPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  const ctx = await requireMerchant(locale);
  const board = await loadBoard(ctx);
  return (
    <CalloutScreen shopName={ctx.merchant.name} timeZone={ctx.merchant.timezone} initial={board} />
  );
}
