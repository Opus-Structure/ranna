"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMerchantSuspendedAction } from "@/app/(console)/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MerchantRowActions({
  merchantId,
  name,
  suspended,
}: {
  merchantId: string;
  name: string;
  suspended: boolean;
}) {
  const t = useTranslations("admin");
  const tb = useTranslations("billing.errors");
  const tc = useTranslations("common.actions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await setMerchantSuspendedAction(merchantId, !suspended);
      if (!result.ok) {
        toast.error(
          result.error === "already_suspended" || result.error === "not_suspended"
            ? tb(result.error)
            : t("errors.generic"),
        );
        return;
      }
      toast.success(t("merchants.updated"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("merchants.actions", { shop: name })}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setOpen(true)}
            className={suspended ? undefined : "text-destructive focus:text-destructive"}
          >
            {suspended ? t("merchants.reactivate") : t("merchants.suspend")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>
              {suspended
                ? t("merchants.reactivateTitle", { shop: name })
                : t("merchants.suspendTitle", { shop: name })}
            </DialogTitle>
            <DialogDescription>
              {suspended ? t("merchants.reactivateBody") : t("merchants.suspendBody")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{tc("cancel")}</Button>
            </DialogClose>
            <Button
              variant={suspended ? "default" : "destructive"}
              disabled={pending}
              onClick={confirm}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("merchants.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
