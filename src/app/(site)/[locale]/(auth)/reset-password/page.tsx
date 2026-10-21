import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetForm } from "@/components/auth/reset-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title"), robots: { index: false } };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  await initLocale(params);
  const { token, error } = await searchParams;
  const t = await getTranslations("auth");
  const invalid = !token || Boolean(error);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("reset.title")}</h1>
        {invalid ? null : <p className="text-muted-foreground">{t("reset.body")}</p>}
      </header>
      {invalid ? (
        <div className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertDescription>{t("errors.resetInvalid")}</AlertDescription>
          </Alert>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("forgot.submit")}
          </Link>
        </div>
      ) : (
        <ResetForm token={token} />
      )}
    </div>
  );
}
