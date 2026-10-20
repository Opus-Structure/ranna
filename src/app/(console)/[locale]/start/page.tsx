import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/brand-mark";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getMerchantContext } from "@/lib/merchants/context";
import { StartForm } from "./start-form";
import { initLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.start");
  return { title: t("title") };
}

/** For signed-in users without a shop (e.g. a magic-link login that never named one). */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  await requireUser(locale);
  if (await getMerchantContext()) redirect({ href: "/dashboard", locale: locale });
  const t = await getTranslations("console.start");
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <BrandMark duo className="h-14" />
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="leading-relaxed text-muted-foreground">{t("body")}</p>
        </header>
        <StartForm />
      </div>
    </main>
  );
}
