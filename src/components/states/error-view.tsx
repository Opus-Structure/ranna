"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary body: says what happened and offers the one recovery. */
export function ErrorView({
  error,
  reset,
  fullPage = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  fullPage?: boolean;
}) {
  const t = useTranslations("common");
  useEffect(() => {
    // The digest links this to the server log line without exposing details to the user.
    console.error("route error", error.digest ?? error.message);
  }, [error]);
  return (
    <div
      role="alert"
      className={
        fullPage
          ? "grid min-h-dvh place-items-center px-6"
          : "flex max-w-xl flex-col gap-4 rounded-xl border border-dashed p-8"
      }
    >
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold">{t("errors.crashTitle")}</h1>
        <p className="text-muted-foreground">{t("errors.crashBody")}</p>
        <Button onClick={reset} className="self-start">
          <RotateCcw aria-hidden />
          {t("actions.retry")}
        </Button>
      </div>
    </div>
  );
}
