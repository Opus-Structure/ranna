import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { localizedPath } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

/**
 * The page's one action in its working form: name your shop here, continue to sign-up with the
 * name already filled in. A plain GET form, so it works before any JavaScript arrives.
 */
export async function StartForm({
  locale,
  tone = "ground",
  id,
}: {
  locale: AppLocale;
  tone?: "ground" | "clay";
  id: string;
}) {
  const t = await getTranslations("site.start");
  const onClay = tone === "clay";
  return (
    <form
      action={localizedPath("/signup", locale)}
      method="get"
      className="flex w-full max-w-2xl flex-col gap-2"
    >
      <label
        htmlFor={id}
        className={cn("text-sm font-semibold", onClay ? "text-clay-foreground" : "text-foreground")}
      >
        {t("label")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="shop"
          required
          maxLength={80}
          autoComplete="organization"
          placeholder={t("placeholder")}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border px-4 text-base transition-[border-color,box-shadow] outline-none focus-visible:ring-4 sm:flex-1",
            onClay
              ? "border-clay-line bg-clay-foreground text-foreground placeholder:text-foreground/55 focus-visible:border-clay-foreground focus-visible:ring-clay-foreground/30"
              : "border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20",
          )}
        />
        <button
          type="submit"
          className={cn(
            "inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-base font-bold transition-[transform,background-color] focus-visible:outline-3 focus-visible:outline-offset-3 active:scale-[0.98]",
            onClay
              ? "bg-clay-foreground text-clay hover:bg-white focus-visible:outline-clay-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary",
          )}
        >
          {t("submit")}
          <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      <p className={cn("text-sm", onClay ? "text-clay-muted" : "text-muted-foreground")}>
        {t("note")}
      </p>
    </form>
  );
}
