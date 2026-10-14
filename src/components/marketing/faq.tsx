import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const FAQ_KEYS = [
  "app",
  "iphone",
  "internet",
  "payment",
  "hardware",
  "languages",
  "data",
  "cancel",
] as const;

/** Questions owners actually ask, answered plainly (native details/summary, no script). */
export async function Faq() {
  const t = await getTranslations("site.faq");
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <h2 id="faq-title" className="font-display text-3xl leading-tight font-bold sm:text-4xl">
        {t("title")}
      </h2>
      <div className="mt-8 border-t">
        {FAQ_KEYS.map((k) => (
          <details key={k} className="group border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {t(`items.${k}.q`)}
              <Plus
                className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-45"
                aria-hidden
              />
            </summary>
            <p className="max-w-[65ch] pb-6 leading-relaxed text-muted-foreground">
              {t(`items.${k}.a`)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
