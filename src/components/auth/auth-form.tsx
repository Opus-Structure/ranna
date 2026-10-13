"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Mail, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  logInAction,
  magicLinkAction,
  signUpAction,
  type AuthResult,
} from "@/app/(site)/[locale]/(auth)/actions";
import { describedBy, Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRedirectError } from "@/lib/http/redirect-error";
import { cn } from "@/lib/utils";
import { emailSchema, passwordSchema, shopNameSchema } from "@/lib/validation/auth";

type Mode = "login" | "signup";
type Method = "password" | "link";
type Values = { shopName?: string; email: string; password?: string };
type ErrorKey =
  | "invalidCredentials"
  | "emailTaken"
  | "weakPassword"
  | "linkExpired"
  | "emailRequired"
  | "emailInvalid"
  | "shopNameRequired"
  | "shopNameTooLong";

function schemaFor(mode: Mode, method: Method) {
  const password =
    method === "link"
      ? z.string().optional()
      : mode === "signup"
        ? passwordSchema
        : z.string().min(1, { error: "weakPassword" });
  return z.object({
    shopName: mode === "signup" ? shopNameSchema : z.string().optional(),
    email: emailSchema,
    password,
  });
}

export function AuthForm({
  mode,
  next,
  initialError,
}: {
  mode: Mode;
  next?: string;
  initialError?: "link";
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [method, setMethod] = useState<Method>("password");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(
    initialError === "link" ? t("errors.linkExpired") : null,
  );
  const [sent, setSent] = useState<{
    status: "check-email" | "confirm-email";
    email: string;
  } | null>(null);

  const form = useForm<Values>({
    // The schema depends on the chosen method, so it is rebuilt on every render.
    resolver: zodResolver(schemaFor(mode, method)) as never,
    defaultValues: { shopName: "", email: "", password: "" },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, setError } = form;
  const errorText = (key?: string) => (key ? t(`errors.${key as ErrorKey}`) : undefined);

  function apply(result: AuthResult) {
    if (result.ok) {
      setSent({ status: result.status, email: result.email });
      return;
    }
    for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof Values, { message: key });
    }
    if (result.formError === "rateLimited") {
      setFormError(tc("errors.rateLimited", { seconds: result.retryAfterSec ?? 60 }));
    } else if (result.formError === "generic") {
      setFormError(tc("errors.generic"));
    } else if (result.formError) {
      setFormError(t(`errors.${result.formError}`));
    }
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      try {
        let result: AuthResult;
        if (method === "link") {
          result = await magicLinkAction(locale, {
            email: values.email,
            shopName: mode === "signup" ? values.shopName : undefined,
          });
        } else if (mode === "signup") {
          result = await signUpAction(locale, {
            email: values.email,
            password: values.password ?? "",
            shopName: values.shopName ?? "",
          });
        } else {
          result = await logInAction(
            locale,
            { email: values.email, password: values.password ?? "" },
            next,
          );
        }
        apply(result);
      } catch (err) {
        // A successful sign-in redirects by throwing; Next must receive it untouched.
        if (isRedirectError(err)) throw err;
        setFormError(navigator.onLine ? tc("errors.generic") : tc("errors.network"));
      }
    });
  });

  if (sent) {
    const magic = sent.status === "check-email";
    return (
      <div className="flex flex-col gap-4" role="status" aria-live="polite">
        <span className="grid size-12 place-items-center rounded-full bg-state-ready/12 text-state-ready">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="font-display text-2xl font-semibold">
          {magic ? t("magic.sentTitle") : t("confirm.title")}
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          {magic
            ? t("magic.sentBody", { email: sent.email })
            : t("confirm.body", { email: sent.email })}
        </p>
        <Button variant="outline" className="self-start" onClick={() => setSent(null)}>
          {t("magic.useAnother")}
        </Button>
      </div>
    );
  }

  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "signup" ? (
        <Field
          id="shopName"
          label={t("fields.shopName")}
          hint={t("fields.shopNameHint")}
          error={errorText(e.shopName?.message)}
        >
          <Input
            id="shopName"
            autoComplete="organization"
            className="h-11"
            aria-invalid={Boolean(e.shopName) || undefined}
            aria-describedby={describedBy("shopName", { error: e.shopName, hint: true })}
            {...register("shopName")}
          />
        </Field>
      ) : null}

      <Field id="email" label={t("fields.email")} error={errorText(e.email?.message)}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          className="h-11 rtl:text-end"
          aria-invalid={Boolean(e.email) || undefined}
          aria-describedby={describedBy("email", { error: e.email })}
          {...register("email")}
        />
      </Field>

      <fieldset className="flex flex-col">
        <legend className="mb-2 text-sm font-medium">{t("method.label")}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["password", "link"] as const).map((m) => (
            <label
              key={m}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
                method === m
                  ? "bg-card text-foreground shadow-[0_1px_2px_oklch(0.235_0.018_40/0.12)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => {
                  setMethod(m);
                  form.clearErrors("password");
                }}
                className="sr-only"
              />
              {m === "password" ? (
                <KeyRound className="size-4" aria-hidden />
              ) : (
                <Mail className="size-4" aria-hidden />
              )}
              {m === "password" ? t("method.password") : t("method.magicLink")}
            </label>
          ))}
        </div>
      </fieldset>

      {method === "password" ? (
        <Field
          id="password"
          label={t("fields.password")}
          hint={mode === "signup" ? t("fields.passwordHint") : undefined}
          error={errorText(e.password?.message)}
        >
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            dir="ltr"
            className="h-11"
            aria-invalid={Boolean(e.password) || undefined}
            aria-describedby={describedBy("password", {
              error: e.password,
              hint: mode === "signup",
            })}
            {...register("password")}
          />
        </Field>
      ) : null}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {method === "link"
          ? t("magic.submit")
          : mode === "signup"
            ? t("signup.submit")
            : t("login.submit")}
      </Button>
    </form>
  );
}
