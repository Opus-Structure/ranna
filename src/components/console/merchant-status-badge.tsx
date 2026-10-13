import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

type Status = "pending_payment" | "active" | "past_due" | "suspended" | "canceled";

const tone: Record<Status, string> = {
  active: "bg-state-ready/14 text-state-ready",
  pending_payment: "bg-primary/12 text-primary",
  past_due: "bg-state-preparing/24 text-foreground",
  suspended: "bg-destructive/12 text-destructive",
  canceled: "bg-muted text-muted-foreground",
};

export async function MerchantStatusBadge({ status }: { status: Status }) {
  const t = await getTranslations("admin.status");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone[status],
      )}
    >
      <span aria-hidden className="size-1.5 rotate-45 rounded-[1px] bg-current" />
      {t(status)}
    </span>
  );
}
