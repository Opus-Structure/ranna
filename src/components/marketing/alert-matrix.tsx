import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const rows = ["android", "iphoneApp", "iphoneSafari", "any"] as const;

/** What rings, on which phone: the platform limits stated up front, not in small print. */
export async function AlertMatrix() {
  const t = await getTranslations("site.alerts");
  return (
    <section aria-labelledby="alerts-title" className="bg-foreground text-background">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <h2
            id="alerts-title"
            className="font-display text-3xl leading-tight font-bold text-balance sm:text-4xl"
          >
            {t("title")}
          </h2>
          <p className="mt-3 max-w-[44ch] text-background/75">{t("body")}</p>
          <Link
            href="#faq"
            className="mt-5 inline-block font-semibold underline underline-offset-4 hover:no-underline"
          >
            {t("more")}
          </Link>
        </div>
        <dl className="divide-y divide-background/15 border-y border-background/15">
          {rows.map((r) => (
            <div key={r} className="grid gap-1 py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
              <dt className="font-semibold">{t(`rows.${r}.phone`)}</dt>
              <dd className="text-background/80">{t(`rows.${r}.rings`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
