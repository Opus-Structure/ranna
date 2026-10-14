"use client";

import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approvePaymentAction, rejectPaymentAction } from "@/app/(console)/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PaymentReview({ paymentId, shop }: { paymentId: string; shop: string }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common.actions");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(kind: "approve" | "reject") {
    startTransition(async () => {
      const result =
        kind === "approve"
          ? await approvePaymentAction(paymentId)
          : await rejectPaymentAction(paymentId, note);
      if (!result.ok) {
        toast.error(result.error === "not_found" ? t("errors.not_found") : t("errors.generic"));
        return;
      }
      toast.success(kind === "approve" ? t("payments.approved") : t("payments.rejected"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run("approve")}
        aria-label={`${t("payments.approve")} · ${shop}`}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {t("payments.approve")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            <X aria-hidden />
            {t("payments.reject")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("payments.reject")} · {shop}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`note-${paymentId}`}>{t("payments.rejectNote")}</Label>
            <Textarea
              id={`note-${paymentId}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("payments.rejectPlaceholder")}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{tc("cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => run("reject")}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("payments.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
