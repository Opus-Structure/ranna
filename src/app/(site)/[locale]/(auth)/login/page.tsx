import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/http/request";
import { initLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("submit"), robots: { index: false } };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const locale = await initLocale(params);
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next, "/dashboard");
  if (await getSessionUser()) redirect({ href: nextPath, locale: locale });

  const t = await getTranslations("auth.login");
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
      </header>
      <AuthForm mode="login" next={nextPath} initialError={error === "link" ? "link" : undefined} />
      <p className="text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
