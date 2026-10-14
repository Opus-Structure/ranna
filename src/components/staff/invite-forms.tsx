"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import {
  acceptInviteAction,
  inviteSignupAction,
  type InviteActionResult,
} from "@/app/(site)/[locale]/(auth)/invite/[token]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

function useInviteAction() {
  const t = useTranslations("invite");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const run = (fn: () => Promise<InviteActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) setSentTo(result.email);
      else setError(t(`errors.${result.error}`));
    });
  return { pending, error, sentTo, run };
}

/** Signed in with the invited address: one button. */
export function AcceptInvite({ token, shopName }: { token: string; shopName: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const { pending, error, run } = useInviteAction();
  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={pending}
        onClick={() => run(() => acceptInviteAction(locale, token))}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("accept", { shop: shopName })}
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Not signed in: create an account for the invited address (or log in to an existing one). */
export function InviteSignup({ token, email }: { token: string; email: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const { pending, error, sentTo, run } = useInviteAction();

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-xl border p-5">
        <MailCheck className="size-6 text-muted-foreground" aria-hidden />
        <p className="font-semibold">{t("checkEmail.title")}</p>
        <p className="text-muted-foreground">{t("checkEmail.body", { email: sentTo })}</p>
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    run(() => inviteSignupAction(locale, token, password));
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("signup.email")}
          <Input
            value={email}
            readOnly
            dir="ltr"
            className="h-11 bg-muted font-normal"
            autoComplete="username"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("signup.password")}
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            aria-describedby="password-hint"
            aria-invalid={error ? true : undefined}
            className="h-11 font-normal"
          />
          <span id="password-hint" className="font-normal text-muted-foreground">
            {t("signup.passwordHint")}
          </span>
        </label>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("signup.submit")}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {t("signup.haveAccount")}{" "}
        <Link
          href={{ pathname: "/login", query: { next: `/invite/${token}` } }}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("signup.logIn")}
        </Link>
      </p>
    </div>
  );
}
