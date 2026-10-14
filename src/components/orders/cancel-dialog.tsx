"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { BoardOrder } from "@/lib/orders/board";
import { cn } from "@/lib/utils";

const QUICK = ["soldOut", "closing", "noShow", "duplicate"] as const;

/** Cancelling needs a reason: the customer reads it on their order page. */
export function CancelDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: BoardOrder | null;
  onClose: () => void;
  onConfirm: (order: BoardOrder, reason: string) => void;
}) {
  const t = useTranslations("orders.cancel");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    const text = reason.trim();
    if (!text) {
      setError(true);
      return;
    }
    onConfirm(order, text);
    setReason("");
    setError(false);
  }

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          setError(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t("title", { number: order?.number ?? "" })}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">{t("reason")}</legend>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((key) => {
                const text = t(`reasons.${key}`);
                const on = reason.trim() === text;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setReason(text);
                      setError(false);
                    }}
                    className={cn(
                      "h-10 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      on ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                    )}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(false);
              }}
              maxLength={200}
              rows={2}
              placeholder={t("placeholder")}
              aria-label={t("reason")}
              aria-invalid={error || undefined}
              aria-describedby={error ? "cancel-reason-error" : undefined}
            />
            {error ? (
              <p id="cancel-reason-error" className="text-sm font-semibold text-destructive">
                {t("required")}
              </p>
            ) : null}
          </fieldset>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("keep")}
            </Button>
            <Button type="submit" variant="destructive">
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
