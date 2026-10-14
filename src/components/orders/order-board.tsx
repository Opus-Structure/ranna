"use client";

import { Bell, BellOff } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { changeStatusAction } from "@/app/(console)/[locale]/dashboard/orders/actions";
import { Button } from "@/components/ui/button";
import type { Board, BoardOrder } from "@/lib/orders/board";
import {
  playChime,
  setSoundPreference,
  soundPreference,
  soundUnlocked,
  unlockSound,
} from "@/lib/orders/chime";
import type { OrderStatus } from "@/lib/orders/transitions";
import { useBoardLive, useNow } from "@/lib/orders/use-board-live";
import { cn } from "@/lib/utils";
import { CancelDialog } from "./cancel-dialog";
import { OrderCard, toneFor } from "./order-card";

const lanes = [
  { key: "new", statuses: ["new", "accepted"] },
  { key: "preparing", statuses: ["preparing"] },
  { key: "ready", statuses: ["ready"] },
] as const satisfies readonly { key: string; statuses: readonly OrderStatus[] }[];
type LaneKey = (typeof lanes)[number]["key"];

/**
 * The live order board: New → Preparing → Ready. Moves show at once (optimistic) and are then
 * confirmed by a fresh read. A new order chimes and puts a count in the tab title.
 */
export function OrderBoard({
  merchantId,
  timeZone,
  initial,
}: {
  merchantId: string;
  timeZone: string;
  initial: Board;
}) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const { board, setBoard, live, refresh } = useBoardLive(merchantId, initial);
  const now = useNow(30_000, initial.generatedAt);
  const [lane, setLane] = useState<LaneKey>("new");
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [canceling, setCanceling] = useState<BoardOrder | null>(null);
  const [, startTransition] = useTransition();
  const [sound, setSound] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const seen = useRef(new Set(initial.open.filter((o) => o.status === "new").map((o) => o.id)));

  // Sound needs one tap on the page before browsers allow it.
  useEffect(() => {
    const on = soundPreference();
    setSound(on);
    setNeedsTap(on && !soundUnlocked());
    const unlock = () => void unlockSound().then((ok) => ok && setNeedsTap(false));
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Chime for orders not seen before; the tab title carries the count of new orders.
  const newOrders = board.open.filter((o) => o.status === "new");
  useEffect(() => {
    const fresh = newOrders.filter((o) => !seen.current.has(o.id));
    fresh.forEach((o) => seen.current.add(o.id));
    if (fresh.length && sound) playChime();
  }, [newOrders, sound]);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = newOrders.length ? `(${newOrders.length}) ${base}` : base;
  }, [newOrders.length]);

  function move(order: BoardOrder, to: OrderStatus, cancelReason?: string) {
    setPending((p) => new Set(p).add(order.id));
    const before = board;
    // Optimistic: the card jumps lanes now; a refresh confirms or corrects it.
    setBoard((b) => ({
      ...b,
      open: b.open
        .map((o) =>
          o.id === order.id ? { ...o, status: to, statusAt: new Date().toISOString() } : o,
        )
        .filter((o) => (to !== "completed" && to !== "canceled" ? true : o.id !== order.id)),
    }));
    startTransition(async () => {
      try {
        const result = await changeStatusAction({ orderId: order.id, to, cancelReason });
        if (!result.ok) {
          setBoard(before);
          toast.error(t(`errors.${result.error}` as "errors.generic"));
        } else if (to === "ready") {
          toast.success(t("toast.ready", { number: order.number }));
        }
      } catch {
        setBoard(before);
        toast.error(t("errors.generic"));
      } finally {
        setPending((p) => {
          const n = new Set(p);
          n.delete(order.id);
          return n;
        });
        void refresh();
      }
    });
  }

  const byLane = (key: LaneKey) => {
    const statuses = lanes.find((l) => l.key === key)!.statuses as readonly OrderStatus[];
    return board.open.filter((o) => statuses.includes(o.status));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span
            aria-hidden
            className={cn(
              "size-2 rotate-45 rounded-[1px]",
              live === "live" ? "bg-state-ready" : "bg-muted-foreground/50",
            )}
          />
          {live === "live" ? t("live") : t("offline")}
        </p>
        {needsTap ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void unlockSound().then((ok) => ok && setNeedsTap(false))}
          >
            <Bell className="size-4" aria-hidden />
            {t("sound.enable")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={sound}
            onClick={() => {
              setSound(!sound);
              setSoundPreference(!sound);
              if (!sound) void unlockSound().then(() => playChime());
            }}
          >
            {sound ? (
              <Bell className="size-4" aria-hidden />
            ) : (
              <BellOff className="size-4" aria-hidden />
            )}
            {sound ? t("sound.on") : t("sound.off")}
          </Button>
        )}
      </div>

      {/* Phones: one lane at a time. The counts stay visible on the switcher. */}
      <div
        role="tablist"
        aria-label={t("lanesLabel")}
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 lg:hidden"
      >
        {lanes.map((l) => {
          const n = byLane(l.key).length;
          const on = lane === l.key;
          return (
            <button
              key={l.key}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`lane-${l.key}`}
              onClick={() => setLane(l.key)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
                on ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn("size-2 rotate-45 rounded-[1px]", toneFor[l.statuses[0]])}
              />
              {t(`lanes.${l.key}`)}
              <span className="font-display tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {lanes.map((l) => {
          const orders = byLane(l.key);
          return (
            <section
              key={l.key}
              id={`lane-${l.key}`}
              aria-labelledby={`lane-title-${l.key}`}
              className={cn("flex min-w-0 flex-col gap-3", lane !== l.key && "max-lg:hidden")}
            >
              {/* On phones the switcher above already names the lane and its count. */}
              <h2
                id={`lane-title-${l.key}`}
                className="flex items-baseline gap-2 border-b pb-2 max-lg:sr-only"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 translate-y-[-2px] rotate-45 rounded-[1px]",
                    toneFor[l.statuses[0]],
                  )}
                />
                <span className="font-semibold">{t(`lanes.${l.key}`)}</span>
                <span className="ms-auto font-display text-2xl font-bold tabular-nums">
                  {orders.length}
                </span>
              </h2>
              {orders.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t(`empty.${l.key}`)}
                </p>
              ) : (
                orders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    now={now}
                    prepTargetMinutes={board.prepTargetMinutes}
                    pending={pending.has(o.id)}
                    onMove={(order, to) => move(order, to)}
                    onCancel={setCanceling}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>

      <details className="group rounded-xl border">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold">
          {t("done.title")}
          <span className="font-display text-muted-foreground tabular-nums">
            {board.done.length}
          </span>
        </summary>
        {board.done.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{t("done.empty")}</p>
        ) : (
          <ul className="divide-y border-t">
            {board.done.map((o) => (
              <li key={o.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                <span className="w-14 order-number text-xl">{o.number}</span>
                <span className="min-w-0 flex-1 truncate">{o.customerName}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rotate-45 rounded-[1px]", toneFor[o.status])}
                  />
                  {t(`status.${o.status}`)}
                </span>
                <time
                  dateTime={o.statusAt}
                  className="w-14 text-end text-muted-foreground tabular-nums"
                >
                  {format.dateTime(new Date(o.statusAt), {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone,
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </details>

      <CancelDialog
        order={canceling}
        onClose={() => setCanceling(null)}
        onConfirm={(order, reason) => {
          setCanceling(null);
          move(order, "canceled", reason);
        }}
      />
    </div>
  );
}
