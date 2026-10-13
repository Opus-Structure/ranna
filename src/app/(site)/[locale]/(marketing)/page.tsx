import { BellRing } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WaitBand } from "@/components/brand/wait-band";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";

/** Phase 1 landing: the promise and the way in. The full marketing page lands in phase 9. */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  await initLocale(params);
  const t = await getTranslations("site.hero");
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-20">
      <section className="flex flex-col gap-6">
        <h1 className="max-w-[16ch] font-display text-4xl leading-[1.08] font-bold sm:text-5xl lg:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-[56ch] text-lg leading-relaxed text-muted-foreground">{t("body")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/signup">{t("cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12 px-6 text-base">
            <Link href="/login">{t("secondary")}</Link>
          </Button>
        </div>
      </section>
      <section
        aria-hidden
        className="rounded-2xl bg-clay p-8 text-clay-foreground shadow-[0_24px_60px_-28px_oklch(0.38_0.105_30/0.6)]"
      >
        <div className="flex items-end justify-between gap-6">
          <span className="order-number text-[7.5rem] sm:text-[9rem]" data-numeric>
            107
          </span>
          <span className="mb-4 grid size-12 place-items-center rounded-full bg-state-ready text-state-ready-foreground">
            <BellRing className="size-6" />
          </span>
        </div>
        <div className="mt-6 text-clay-foreground [--band-empty:var(--clay-line)] [--band-ink:var(--clay-foreground)]">
          <WaitBand elapsedMinutes={7} targetMinutes={10} />
        </div>
      </section>
    </main>
  );
}
