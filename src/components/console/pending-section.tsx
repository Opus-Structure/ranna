import { getTranslations } from "next-intl/server";

/** Honest placeholder for a console section whose build phase has not landed yet. */
export async function PendingSection() {
  const t = await getTranslations("console.pending");
  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-dashed p-8">
      <span aria-hidden className="band-rule w-24 text-muted-foreground" />
      <h2 className="font-display text-lg font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground">{t("body")}</p>
    </div>
  );
}
