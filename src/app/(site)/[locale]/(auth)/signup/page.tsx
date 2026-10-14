import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { initLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shop?: string }>;
}) {
  const locale = await initLocale(params);
  if (await getSessionUser()) redirect({ href: "/dashboard", locale: locale });

  const t = await getTranslations("auth.signup");
  const linkClass = "text-foreground font-medium underline underline-offset-4";
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
      </header>
      <AuthForm mode="signup" initialShopName={(await searchParams).shop?.slice(0, 80) ?? ""} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.rich("terms", {
          terms: (chunks) => (
            <Link href="/legal/terms" className={linkClass}>
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/legal/privacy" className={linkClass}>
              {chunks}
            </Link>
          ),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("logIn")}
        </Link>
      </p>
    </div>
  );
}
