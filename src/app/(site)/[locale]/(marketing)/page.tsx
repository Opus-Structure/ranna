import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertMatrix } from "@/components/marketing/alert-matrix";
import { CounterBoard } from "@/components/marketing/counter-board";
import { CounterSweep } from "@/components/marketing/counter-sweep";
import { Faq, FAQ_KEYS } from "@/components/marketing/faq";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { StartForm } from "@/components/marketing/start-form";
import { TryDemo } from "@/components/marketing/try-demo";
import { appUrl, brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { initLocale } from "@/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("site.meta");
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: locale === "ar" ? "/" : `/${locale}`,
      languages: { ar: "/", fr: "/fr", en: "/en", "x-default": "/" },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: locale === "ar" ? "/" : `/${locale}`,
      locale,
      siteName: brand.name,
      type: "website",
      images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: brand.name }],
    },
    twitter: { card: "summary", title: t("title"), description: t("description") },
  };
}

/**
 * The landing: the counter before and after, the visitor's own hand doing the sweep, and the
 * way in (name your shop) in the first viewport. Then the three moments, the counter side, the
 * real demo, what rings where, prices, questions, and a closing clay plate with the same action.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await initLocale(params)) as AppLocale;
  const t = await getTranslations("site");
  const tf = await getTranslations("site.faq");
  const base = appUrl();
  const pageUrl = locale === "ar" ? base : `${base}/${locale}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#org`,
        name: brand.name,
        alternateName: brand.nameAr,
        url: base,
        logo: `${base}/icons/icon-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#site`,
        url: base,
        name: brand.name,
        inLanguage: locale,
        publisher: { "@id": `${base}/#org` },
      },
      {
        "@type": "SoftwareApplication",
        name: brand.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: t("meta.description"),
        url: pageUrl,
        inLanguage: ["ar", "fr", "en"],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_KEYS.map((k) => ({
          "@type": "Question",
          name: tf(`items.${k}.q`),
          acceptedAnswer: { "@type": "Answer", text: tf(`items.${k}.a`) },
        })),
      },
    ],
  };
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section
        aria-labelledby="hero-title"
        className="mx-auto w-full max-w-6xl px-4 pt-3 pb-5 sm:px-6 sm:pt-6 sm:pb-8"
      >
        <h1
          id="hero-title"
          className="max-w-[24ch] font-display text-[clamp(2.1rem,4.5vw,4rem)] leading-[1.05] font-bold text-balance"
        >
          {t("hero.title")}
        </h1>
        <p className="mt-2 max-w-[80ch] text-lg leading-relaxed text-muted-foreground sm:mt-3">
          {t("hero.body")}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:gap-3 lg:flex-row lg:items-end lg:gap-8">
          <StartForm locale={locale} id="start-top" />
          <Link
            href="#try"
            className="w-fit pb-1 text-sm font-semibold underline underline-offset-4 hover:no-underline lg:mb-9"
          >
            {t("hero.demo")}
          </Link>
        </div>
      </section>

      <CounterSweep />
      <HowItWorks />
      <CounterBoard />
      <TryDemo />
      <AlertMatrix />
      <Pricing locale={locale} />
      <Faq />

      <section aria-labelledby="close-title" className="bg-clay text-clay-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2
              id="close-title"
              className="max-w-[16ch] font-display text-3xl leading-tight font-bold text-balance sm:text-5xl"
            >
              {t("close.title")}
            </h2>
            <p className="mt-4 max-w-[44ch] text-clay-muted">{t("close.body")}</p>
          </div>
          <StartForm locale={locale} tone="clay" id="start-bottom" />
        </div>
      </section>
    </main>
  );
}
