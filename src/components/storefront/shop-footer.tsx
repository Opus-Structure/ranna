import { MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { brandName } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const languageNames: Record<AppLocale, string> = { ar: "العربية", fr: "Français", en: "English" };

export async function ShopFooter({
  slug,
  locale,
  locales,
  phone,
  address,
  table,
}: {
  slug: string;
  locale: AppLocale;
  locales: string[];
  phone: string | null;
  address: string | null;
  table?: string;
}) {
  const t = await getTranslations("storefront");
  const shopLocales = locales.filter(isAppLocale);
  return (
    <footer className="mx-auto flex max-w-2xl flex-col gap-4 border-t border-[var(--shop-line)] px-4 pt-6 pb-40 text-sm text-[var(--shop-muted)]">
      {address ? (
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{address}</span>
        </p>
      ) : null}
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^+0-9]/g, "")}`}
          className="flex items-center gap-2 font-semibold text-[var(--brand-ink)]"
        >
          <Phone className="size-4" aria-hidden />
          <span dir="ltr">{phone}</span>
          <span className="sr-only">{t("call")}</span>
        </a>
      ) : null}
      {shopLocales.length > 1 ? (
        <nav aria-label={t("language")} className="flex flex-wrap gap-2">
          {shopLocales.map((l) => (
            <Link
              key={l}
              href={{ pathname: `/s/${slug}`, query: table ? { t: table } : {} }}
              locale={l}
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 font-semibold",
                l === locale
                  ? "border-[var(--brand-ink)] text-[var(--brand-ink)]"
                  : "border-[var(--shop-line)]",
              )}
            >
              {languageNames[l]}
            </Link>
          ))}
        </nav>
      ) : null}
      <p className="text-xs">{t("poweredBy", { brand: brandName(locale) })}</p>
    </footer>
  );
}
