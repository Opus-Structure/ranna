"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { requestPasswordResetAction } from "@/app/(site)/[locale]/(auth)/actions";
import { describedBy, Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotSchema, type ForgotInput } from "@/lib/validation/auth";

export function ForgotForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema) as never,
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await requestPasswordResetAction(locale, values);
        if (result.ok) setSentTo(result.email);
        else if (result.formError === "rateLimited") {
          setFormError(tc("errors.rateLimited", { seconds: result.retryAfterSec ?? 60 }));
        } else setFormError(tc("errors.generic"));
      } catch {
        setFormError(navigator.onLine ? tc("errors.generic") : tc("errors.network"));
      }
    });
  });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-live="polite">
        <span className="grid size-12 place-items-center rounded-full bg-state-ready/12 text-state-ready">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-semibold">{t("forgot.sentTitle")}</h2>
        <p className="leading-relaxed text-muted-foreground">
          {t("forgot.sentBody", { email: sentTo })}
        </p>
      </div>
    );
  }

  const emailError = formState.errors.email?.message;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Field
        id="email"
        label={t("fields.email")}
        error={
          emailError ? t(`errors.${emailError as "emailRequired" | "emailInvalid"}`) : undefined
        }
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          className="h-11 rtl:text-end"
          aria-invalid={Boolean(emailError) || undefined}
          aria-describedby={describedBy("email", { error: formState.errors.email })}
          {...register("email")}
        />
      </Field>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("forgot.submit")}
      </Button>
    </form>
  );
}
