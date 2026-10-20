"use client";

import {
  BellRing,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  PersonStanding,
  Printer,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { WaitBand } from "@/components/brand/wait-band";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardOrder } from "@/lib/orders/board";
import type { OrderStatus } from "@/lib/orders/transitions";
import { cn } from "@/lib/utils";

/** The one obvious next step for each open status. */
const primary: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "preparing",
  accepted: "preparing",
  preparing: "ready",
  ready: "completed",
};

/** Less common moves, kept in the menu so a hurried tap can't hit them. */
const secondary: Partial<
  Record<OrderStatus, { to: OrderStatus; label: "readyNow" | "backToPreparing" }>
> = {
  new: { to: "ready", label: "readyNow" },
  accepted: { to: "ready", label: "readyNow" },
  ready: { to: "preparing", label: "backToPreparing" },
};

export const toneFor: Record<OrderStatus, string> = {
  new: "bg-state-new",
  accepted: "bg-state-new",
  preparing: "bg-state-preparing",
  ready: "bg-state-ready",
  completed: "bg-state-done",
  canceled: "bg-state-canceled",
};

export function OrderCard({
  order,
  now,
  prepTargetMinutes,
  pending,
  onMove,
  onCancel,
  onRing,
  onPrint,
}: {
  order: BoardOrder;
  now: number;
  prepTargetMinutes: number;
  pending: boolean;
  onMove: (order: BoardOrder, to: OrderStatus) => void;
  onCancel?: (order: BoardOrder) => void;
  onRing: (order: BoardOrder) => void;
  /** Present when the shop prints kitchen tickets: reprint this order's slip. */
  onPrint?: (order: BoardOrder) => void;
}) {
  const t = useTranslations("orders");
  const waited = Math.max(0, Math.floor((now - Date.parse(order.statusAt)) / 60_000));
  const total = Math.max(0, Math.floor((now - Date.parse(order.placedAt)) / 60_000));
  const next = primary[order.status];
  const extra = secondary[order.status];
  const late = order.status !== "ready" && total > prepTargetMinutes;

  return (
    <article
      aria-labelledby={`order-${order.id}`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgb(31_26_23/0.06)] transition-opacity",
        pending && "opacity-70",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`order-${order.id}`} className="order-number text-4xl" data-numeric>
            <span className="sr-only">{t("orderLabel")} </span>
            {order.number}
          </h3>
          <p className="truncate font-semibold">{order.customerName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              late ? "text-primary" : "text-muted-foreground",
            )}
            title={t("placedAgo", { minutes: total })}
          >
            {t("waited", { minutes: waited })}
          </p>
          {order.tableLabel ? (
            <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold">
              {order.tableLabel}
            </span>
          ) : null}
        </div>
      </header>

      {order.status === "ready" ? null : (
        <WaitBand
          elapsedMinutes={total}
          targetMinutes={prepTargetMinutes}
          label={t("waitLabel", { minutes: total, target: prepTargetMinutes })}
        />
      )}

      {order.status === "ready" && order.acknowledgedAt ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-state-ready">
          <PersonStanding className="size-4" aria-hidden />
          {t("acknowledged")}
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {order.items.map((item, i) => (
          <li key={i} className="leading-snug">
            <span className="font-bold tabular-nums">{item.quantity}×</span>{" "}
            <bdi className="font-medium">{item.name}</bdi>
            {item.options.length ? (
              <span className="block text-sm text-muted-foreground">
                {item.options.join(" · ")}
              </span>
            ) : null}
            {item.note ? (
              <span className="block text-sm text-muted-foreground italic">“{item.note}”</span>
            ) : null}
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{order.note}</span>
        </p>
      ) : null}

      {next ? (
        <div className="mt-1 flex items-center gap-2">
          <Button
            size="lg"
            className="h-12 flex-1 text-base"
            disabled={pending}
            onClick={() => onMove(order, next)}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t(`actions.${next}` as "actions.ready")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-12"
                disabled={pending}
                aria-label={t("actions.more", { number: order.number })}
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {order.status === "ready" ? (
                <DropdownMenuItem onSelect={() => onRing(order)}>
                  <BellRing aria-hidden />
                  {t("actions.ringAgain")}
                </DropdownMenuItem>
              ) : null}
              {onPrint ? (
                <DropdownMenuItem onSelect={() => onPrint(order)}>
                  <Printer aria-hidden />
                  {t("kitchen.printTicket")}
                </DropdownMenuItem>
              ) : null}
              {extra ? (
                <>
                  <DropdownMenuItem onSelect={() => onMove(order, extra.to)}>
                    {t(`actions.${extra.label}`)}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {onCancel ? (
                <DropdownMenuItem variant="destructive" onSelect={() => onCancel(order)}>
                  {t("actions.cancel")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </article>
  );
}
