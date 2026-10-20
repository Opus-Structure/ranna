"use client";

import { Bell, BellOff, Check, ChefHat, Loader2, Maximize, Minimize, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { changeStatusAction } from "@/app/(console)/[locale]/dashboard/orders/actions";
import { WaitBand } from "@/components/brand/wait-band";
import { Button } from "@/components/ui/button";
import type { Board, BoardOrder } from "@/lib/orders/board";
import {
  playChime,
  setSoundPreference,
  soundPreference,
  soundUnlocked,
  unlockSound,
} from "@/lib/orders/chime";
import { kitchenQueue } from "@/lib/orders/kitchen";
import { useBoardLive, useNow } from "@/lib/orders/use-board-live";
import { useWakeLock } from "@/lib/orders/use-wake-lock";
import { cn } from "@/lib/utils";
import { toneFor } from "./order-card";

/**
 * The kitchen display: only what has to be made, oldest first, as large cards for a tablet
 * propped up at arm's length. Preparing → Done; Done marks the order Ready, which rings the
 * customer. Same live feed as the board; a new order chimes; the display stays awake.
 */
export function KitchenScreen({ shopName, initial }: { shopName: string; initial: Board }) {
  const t = useTranslations("orders");
  const { board, setBoard, live, refresh } = useBoardLive(initial);
  const now = useNow(15_000, initial.generatedAt);
  const root = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const [sound, setSound] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const awake = useWakeLock(true);
  const seen = useRef(new Set(initial.open.filter((o) => o.status === "new").map((o) => o.id)));

  const queue = useMemo(() => kitchenQueue(board.open), [board.open]);
  const waiting = queue.filter((o) => o.status !== "preparing").length;

  useEffect(() => {
    const on = soundPreference();
    setSound(on);
    setNeedsTap(on && !soundUnlocked());
    const unlock = () => void unlockSound().then((ok) => ok && setNeedsTap(false));
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Chime for each order not seen before; the tab title carries how many are waiting.
  useEffect(() => {
    const fresh = queue.filter((o) => o.status === "new" && !seen.current.has(o.id));
    fresh.forEach((o) => seen.current.add(o.id));
    if (fresh.length && sound) playChime();
  }, [queue, sound]);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = waiting ? `(${waiting}) ${base}` : base;
  }, [waiting]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void root.current?.requestFullscreen?.().catch(() => undefined);
  }

  function move(order: BoardOrder, to: "preparing" | "ready") {
    setPending((p) => new Set(p).add(order.id));
    const before = board;
    setBoard((b) => ({
      ...b,
      open: b.open.map((o) =>
        o.id === order.id ? { ...o, status: to, statusAt: new Date().toISOString() } : o,
      ),
    }));
    startTransition(async () => {
      try {
        const result = await changeStatusAction({ orderId: order.id, to });
        if (!result.ok) {
          setBoard(before);
          toast.error(t(`errors.${result.error}` as "errors.generic"));
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

  return (
    <div
      ref={root}
      className={cn(
        "flex flex-col gap-6 bg-background",
        fullscreen && "min-h-dvh overflow-y-auto p-4 sm:p-6",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {fullscreen ? (
            <p className="font-display text-xl font-bold text-foreground">{shopName}</p>
          ) : null}
          <p className="flex items-center gap-2" aria-live="polite">
            <span
              aria-hidden
              className={cn(
                "size-2 rotate-45 rounded-[1px]",
                live === "live" ? "bg-state-ready" : "bg-muted-foreground/50",
              )}
            />
            {live === "live" ? t("live") : t("offline")}
          </p>
          <p>{awake ? t("kitchen.awake") : t("kitchen.mayDim")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? (
              <Minimize className="size-4" aria-hidden />
            ) : (
              <Maximize className="size-4" aria-hidden />
            )}
            {fullscreen ? t("kitchen.exitFullscreen") : t("kitchen.fullscreen")}
          </Button>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <ChefHat className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-display text-xl font-semibold">{t("kitchen.emptyTitle")}</p>
          <p className="max-w-[40ch] text-muted-foreground">{t("kitchen.emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
          {queue.map((o) => (
            <li key={o.id}>
              <KitchenCard
                order={o}
                now={now}
                prepTargetMinutes={board.prepTargetMinutes}
                pending={pending.has(o.id)}
                onMove={move}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KitchenCard({
  order,
  now,
  prepTargetMinutes,
  pending,
  onMove,
}: {
  order: BoardOrder;
  now: number;
  prepTargetMinutes: number;
  pending: boolean;
  onMove: (order: BoardOrder, to: "preparing" | "ready") => void;
}) {
  const t = useTranslations("orders");
  const total = Math.max(0, Math.floor((now - Date.parse(order.placedAt)) / 60_000));
  const cooking = order.status === "preparing";
  const late = total > prepTargetMinutes;

  return (
    <article
      aria-labelledby={`kitchen-${order.id}`}
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgb(31_26_23/0.06)] transition-opacity",
        pending && "opacity-70",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 id={`kitchen-${order.id}`} className="order-number text-6xl" data-numeric>
          <span className="sr-only">{t("orderLabel")} </span>
          {order.number}
        </h3>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              late ? "text-primary" : "text-muted-foreground",
            )}
            title={t("placedAgo", { minutes: total })}
          >
            {t("waited", { minutes: total })}
          </p>
          {order.tableLabel ? (
            <span className="rounded-md bg-muted px-2.5 py-1 text-base font-semibold">
              {order.tableLabel}
            </span>
          ) : null}
        </div>
      </header>

      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <span
          aria-hidden
          className={cn("size-2.5 rotate-45 rounded-[1px]", toneFor[order.status])}
        />
        {cooking ? t("status.preparing") : t("status.new")}
        <span aria-hidden>·</span>
        <span className="truncate font-normal">{order.customerName}</span>
      </p>

      <WaitBand
        elapsedMinutes={total}
        targetMinutes={prepTargetMinutes}
        label={t("waitLabel", { minutes: total, target: prepTargetMinutes })}
      />

      <ul className="flex flex-1 flex-col gap-3">
        {order.items.map((item, i) => (
          <li key={i} className="text-2xl leading-snug">
            <span className="font-bold tabular-nums">{item.quantity}×</span>{" "}
            <bdi className="font-semibold">{item.name}</bdi>
            {item.options.length ? (
              <span className="block text-lg text-muted-foreground">
                {item.options.join(" · ")}
              </span>
            ) : null}
            {item.note ? (
              <span className="block text-lg text-muted-foreground italic">“{item.note}”</span>
            ) : null}
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-lg font-medium">{order.note}</p>
      ) : null}

      <Button
        size="lg"
        className="h-14 w-full text-lg"
        disabled={pending}
        onClick={() => onMove(order, cooking ? "ready" : "preparing")}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : cooking ? (
          <Check className="size-5" aria-hidden />
        ) : (
          <Play className="size-5" aria-hidden />
        )}
        {cooking ? t("kitchen.done") : t("kitchen.start")}
      </Button>
    </article>
  );
}
