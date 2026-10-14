"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTogglesAction } from "@/app/(console)/[locale]/dashboard/shop/actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Open/closed and taking-orders, saved the moment they are flipped. */
export function ShopToggles({
  isOpen,
  acceptingOrders,
  canEditOpen,
  disabled,
  compact = false,
}: {
  isOpen: boolean;
  acceptingOrders: boolean;
  canEditOpen: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("shopEditor");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic({ isOpen, acceptingOrders });

  function flip(key: "isOpen" | "acceptingOrders", value: boolean) {
    startTransition(async () => {
      setOptimistic((s) => ({ ...s, [key]: value }));
      const result = await setTogglesAction({ [key]: value });
      if (!result.ok) toast.error(t(`errors.${result.error}` as "errors.generic"));
      router.refresh();
    });
  }

  const rows = [
    {
      key: "isOpen" as const,
      label: t("fields.isOpen"),
      hint: t("fields.isOpenHint"),
      editable: canEditOpen,
    },
    {
      key: "acceptingOrders" as const,
      label: t("fields.accepting"),
      hint: t("fields.acceptingHint"),
      editable: true,
    },
  ];

  return (
    <div
      className={cn(
        compact ? "flex flex-wrap items-center gap-x-5 gap-y-2" : "flex flex-col gap-4",
      )}
    >
      {rows.map((r) => (
        <label
          key={r.key}
          className={cn(
            "flex items-center gap-3",
            !compact && "justify-between rounded-xl border p-4",
          )}
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold">{r.label}</span>
            {!compact ? <span className="text-sm text-muted-foreground">{r.hint}</span> : null}
          </span>
          <Switch
            checked={state[r.key]}
            disabled={disabled || !r.editable}
            onCheckedChange={(v) => flip(r.key, v)}
            className="order-first sm:order-none"
          />
        </label>
      ))}
    </div>
  );
}
