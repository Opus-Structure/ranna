"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelSubscriptionAction,
  revertCancelAction,
} from "@/app/(console)/[locale]/dashboard/billing/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Cancel (with confirmation, since it takes the shop offline) or undo a scheduled cancellation. */
export function SubscriptionActions({
  cancelScheduled,
  cancelable,
  endsOn,
  endsNow,
}: {
  cancelScheduled: boolean;
  cancelable: boolean;
  endsOn: string;
  endsNow: boolean;
}) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: typeof cancelSubscriptionAction) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (cancelScheduled) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(revertCancelAction)}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("current.keep")}
      </Button>
    );
  }
  if (!cancelable) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          {t("current.cancel")}
        </Button>
      </DialogTrigger>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{t("cancelDialog.title")}</DialogTitle>
          <DialogDescription>
            {endsNow ? t("cancelDialog.bodyNow") : t("cancelDialog.body", { date: endsOn })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("cancelDialog.keep")}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => run(cancelSubscriptionAction)}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("cancelDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
