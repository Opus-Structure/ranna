"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { describedBy, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRedirectError } from "@/lib/http/redirect-error";
import { createShopAction } from "./actions";

export function StartForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("console.start");
  const tCommon = useTranslations("common.errors");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("shopName") ?? "");
    setError(null);
    startTransition(async () => {
      try {
        const result = await createShopAction(locale, name);
        setError(result.error === "forbidden" ? tCommon("forbidden") : t(`errors.${result.error}`));
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(tCommon("generic"));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field
        id="shopName"
        label={t("fields.shopName")}
        hint={t("fields.shopNameHint")}
        error={error}
      >
        <Input
          id="shopName"
          name="shopName"
          required
          maxLength={80}
          autoComplete="organization"
          className="h-11"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy("shopName", { error, hint: true })}
        />
      </Field>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {tc("submit")}
      </Button>
    </form>
  );
}
