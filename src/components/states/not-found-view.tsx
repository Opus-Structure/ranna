import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function NotFoundView({ homeHref = "/" }: { homeHref?: string }) {
  const t = useTranslations("common.errors");
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <BrandMark duo className="h-14" />
        <p className="order-number text-7xl text-muted-foreground" aria-hidden>
          404
        </p>
        <h1 className="font-display text-2xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("notFoundBody")}</p>
        <Button asChild>
          <Link href={homeHref}>{t("notFoundAction")}</Link>
        </Button>
      </div>
    </main>
  );
}
