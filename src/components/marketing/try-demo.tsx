import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appUrl } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { qrSvg, shopUrl } from "@/lib/qr/matrix";

/**
 * The proof only this product can give: scan, order a coffee from the demo café, and get rung
 * for real. Demo orders move to Ready by themselves (no staff there), which the copy says.
 */
export async function TryDemo() {
  const t = await getTranslations("site.try");
  const qr = qrSvg(shopUrl(appUrl(), "demo"), { dark: "#1f1a17", light: "#ffffff", margin: 2 });
  return (
    <section
      id="try"
      aria-labelledby="try-title"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <div className="grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-16">
        <div className="relative mx-auto w-fit">
          <span
            className="block size-60 rounded-2xl bg-white p-3 shadow-[0_24px_50px_-30px_rgb(31_26_23/0.6)] sm:size-72 [&>svg]:size-full"
            role="img"
            aria-label={t("qrLabel")}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </div>
        <div>
          <h2
            id="try-title"
            className="max-w-[18ch] font-display text-3xl leading-tight font-bold text-balance sm:text-4xl"
          >
            {t("title")}
          </h2>
          <ol className="mt-6 flex max-w-[52ch] list-decimal flex-col gap-2 ps-5 text-lg marker:font-display marker:font-bold">
            <li>{t("steps.scan")}</li>
            <li>{t("steps.order")}</li>
            <li>{t("steps.wait")}</li>
          </ol>
          <p className="mt-5 max-w-[56ch] text-sm text-muted-foreground">{t("note")}</p>
          <Link
            href="/s/demo"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-foreground px-5 font-bold transition-colors hover:bg-foreground hover:text-background focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
          >
            {t("open")}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
