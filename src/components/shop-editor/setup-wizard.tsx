"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeSetupAction } from "@/app/(console)/[locale]/dashboard/shop/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { PublicCategory } from "@/lib/shop/public";
import { cn } from "@/lib/utils";
import { PhonePreview } from "./phone-preview";
import {
  ContactFields,
  HoursFields,
  LanguageFields,
  LookFields,
  NameAndLinkFields,
} from "./sections";
import { useShopDraft, type ShopDraft } from "./use-shop-draft";

const steps = ["link", "look", "hours", "languages"] as const;
type Step = (typeof steps)[number];

/** First-run setup after activation: four short steps, each saved before moving on. */
export function SetupWizard({
  initial,
  menu,
  currency,
  origin,
}: {
  initial: ShopDraft;
  menu: PublicCategory[];
  currency: string;
  origin: string;
}) {
  const t = useTranslations("setup");
  const te = useTranslations("shopEditor");
  const locale = useLocale();
  const router = useRouter();
  const s = useShopDraft(initial);
  const [index, setIndex] = useState(0);
  const [finishing, startFinishing] = useTransition();
  const step: Step = steps[index]!;
  const props = { draft: s.draft, update: s.update, errors: s.errors };

  const savers: Record<Step, () => Promise<boolean>> = {
    link: s.saveSlugAndName,
    look: s.saveLook,
    hours: s.saveHours,
    languages: s.saveProfile,
  };

  async function next() {
    if (!(await savers[step]())) return;
    if (index < steps.length - 1) {
      setIndex(index + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startFinishing(async () => {
      const result = await completeSetupAction();
      if (!result.ok) {
        toast.error(te(`errors.${result.error}` as "errors.generic"));
        if (result.error === "slugRequired") setIndex(0);
        return;
      }
      router.push("/dashboard/menu");
    });
  }

  const busy = s.pending || finishing;
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="setup-step" className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
            {t("progress", { current: index + 1, total: steps.length })}
          </p>
          <ol className="flex items-center gap-2" aria-hidden>
            {steps.map((st, i) => (
              <li key={st} className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 rotate-45 rounded-[1px] border-[1.5px]",
                    i < index
                      ? "border-state-ready bg-state-ready"
                      : i === index
                        ? "border-primary bg-primary"
                        : "border-input",
                  )}
                />
                {i < steps.length - 1 ? <span className="h-px w-8 bg-border" /> : null}
              </li>
            ))}
          </ol>
          <h2 id="setup-step" className="font-display text-2xl font-bold">
            {t(`steps.${step}`)}
          </h2>
          <p className="text-muted-foreground">{t(`intro.${step}`)}</p>
        </div>

        {step === "link" ? <NameAndLinkFields {...props} origin={origin} /> : null}
        {step === "look" ? <LookFields {...props} /> : null}
        {step === "hours" ? (
          <>
            <HoursFields {...props} />
            <ContactFields {...props} />
          </>
        ) : null}
        {step === "languages" ? <LanguageFields {...props} /> : null}

        <div className="flex flex-wrap gap-3 border-t pt-6">
          {index > 0 ? (
            <Button
              variant="outline"
              size="lg"
              className="h-12"
              disabled={busy}
              onClick={() => setIndex(index - 1)}
            >
              <ArrowLeft className="rtl:rotate-180" aria-hidden />
              {t("back")}
            </Button>
          ) : null}
          <Button size="lg" className="h-12 px-6" disabled={busy} onClick={() => void next()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {index === steps.length - 1 ? t("finish") : t("next")}
            {!busy ? <ArrowRight className="rtl:rotate-180" aria-hidden /> : null}
          </Button>
        </div>
      </section>
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <PhonePreview draft={s.draft} menu={menu} currency={currency} locale={locale} />
      </aside>
    </div>
  );
}
