"use client";

import { Check, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/app/(site)/[locale]/(auth)/actions";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { passwordSchema } from "@/lib/validation/auth";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!passwordSchema.safeParse(password).success) {
      setFieldError(t("errors.weakPassword"));
      return;
    }
    setFieldError(null);
    startTransition(async () => {
      try {
        const result = await resetPasswordAction(locale, { token, password });
        if (result.ok) setDone(true);
        else if (result.formError === "generic") setFormError(tc("errors.generic"));
        else setFormError(t(`errors.${result.formError}`));
      } catch {
        setFormError(navigator.onLine ? tc("errors.generic") : tc("errors.network"));
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-live="polite">
        <span className="grid size-12 place-items-center rounded-full bg-state-ready/12 text-state-ready">
          <Check className="size-6" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-semibold">{t("reset.done")}</h2>
        <p className="leading-relaxed text-muted-foreground">{t("reset.doneBody")}</p>
        <Button asChild className="self-start">
          <Link href="/login">{t("reset.toLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {formError ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Field
        id="password"
        label={t("fields.password")}
        hint={t("fields.passwordHint")}
        error={fieldError ?? undefined}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          className="h-11"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(fieldError) || undefined}
        />
      </Field>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("reset.submit")}
      </Button>
    </form>
  );
}
