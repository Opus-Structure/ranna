import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { merchantAccess } from "@/lib/billing/access";
import type { MerchantContext } from "@/lib/merchants/context";

/**
 * Wraps an editable console screen. While the account is not active (or past its grace
 * period) every control inside is disabled and the reason is stated once. Mutations are
 * refused server-side as well (`assertCanEdit`); this is the visible half of that rule.
 */
export async function EditGate({ ctx, children }: { ctx: MerchantContext; children: ReactNode }) {
  if (merchantAccess(ctx.merchant).canEdit) return <>{children}</>;
  const t = await getTranslations("console.account");
  return (
    <>
      <p
        id="read-only-note"
        className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground"
      >
        <Lock className="size-4" aria-hidden />
        {t("readOnly")}
      </p>
      <fieldset disabled aria-describedby="read-only-note" className="contents">
        {children}
      </fieldset>
    </>
  );
}
