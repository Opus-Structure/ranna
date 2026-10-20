"use client";

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import {
  submitRegisterAction,
  type VerifyError,
} from "@/app/(console)/[locale]/dashboard/verify/actions";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

export function VerifyForm() {
  const t = useTranslations("console.verify");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<VerifyError | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const result = await submitRegisterAction(form);
      if (result.ok) router.replace("/dashboard/setup");
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5">
      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li>{t("pointTrial")}</li>
        <li>{t("pointOnce")}</li>
        <li>{t("pointPrivate")}</li>
      </ul>
      {error ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <fieldset disabled={pending} className="flex flex-col gap-5">
        <Field id="registerNumber" label={t("number")} hint={t("numberHint")}>
          <Input
            id="registerNumber"
            name="registerNumber"
            required
            dir="ltr"
            autoComplete="off"
            maxLength={40}
            className="h-11"
          />
        </Field>
        <Field id="register" label={t("file")} hint={t("fileHint")}>
          <Input
            id="register"
            name="register"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="h-11 py-2"
          />
        </Field>
        <Button type="submit" size="lg" className="h-12 self-start px-6">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {t("submit")}
        </Button>
      </fieldset>
    </form>
  );
}
