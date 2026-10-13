import { AlertTriangle, Clock, Lock } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ConsoleMerchant, MemberRole } from "@/lib/merchants/context";
import { cn } from "@/lib/utils";

/**
 * Account state, stated once at the top of every console page with the one way out.
 * Active accounts render nothing.
 */
export async function AccountBanner({
  merchant,
  role,
}: {
  merchant: ConsoleMerchant;
  role: MemberRole;
}) {
  if (merchant.status === "active") return null;
  const t = await getTranslations("console.account");
  const format = await getFormatter();
  const status = merchant.status;
  const tone =
    status === "past_due"
      ? "bg-state-preparing/18 text-foreground"
      : status === "pending_payment"
        ? "bg-primary/10 text-foreground"
        : "bg-destructive/12 text-foreground";
  const Icon = status === "past_due" ? Clock : status === "pending_payment" ? Lock : AlertTriangle;
  const date = merchant.graceUntil ? format.dateTime(merchant.graceUntil, "short") : "";

  return (
    <div role="status" className={cn("border-b px-4 py-3.5 sm:px-6 lg:px-10", tone)}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3">
        <Icon className="size-5 shrink-0" aria-hidden />
        <div className="flex min-w-[15rem] flex-1 flex-col gap-0.5">
          <p className="font-semibold">{t(`${status}.title`, { date })}</p>
          <p className="text-sm text-muted-foreground">
            {role === "owner" ? t(`${status}.body`) : t("readOnly")}
          </p>
        </div>
        {role === "owner" ? (
          <Button asChild size="sm" variant={status === "pending_payment" ? "default" : "outline"}>
            <Link href="/dashboard/billing">{t(`${status}.action`)}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
