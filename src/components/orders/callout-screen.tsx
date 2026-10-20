"use client";

import { Maximize, MonitorSpeaker } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Board } from "@/lib/orders/board";
import { playChime, unlockSound } from "@/lib/orders/chime";
import { useBoardLive, useNow } from "@/lib/orders/use-board-live";
import { cn } from "@/lib/utils";

const FRESH_MS = 60_000;

/**
 * The customer-facing call-out screen: numbers only (no names on a public display). "Ready"
 * takes two thirds of the width in the reserved enamel green; a number that just turned ready
 * is ringed for a minute and chimes once.
 */
export function CalloutScreen({
  shopName,
  timeZone,
  initial,
}: {
  shopName: string;
  timeZone: string;
  initial: Board;
}) {
  const t = useTranslations("orders.screen");
  const format = useFormatter();
  const { board, live } = useBoardLive(initial);
  const now = useNow(15_000, initial.generatedAt);
  const [started, setStarted] = useState(false);
  // When each number first appeared as ready on this screen (0 = was already there at start).
  const [readySince, setReadySince] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.open.filter((o) => o.status === "ready").map((o) => [o.id, 0])),
  );
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const preparing = board.open
    .filter((o) => o.status !== "ready")
    .sort((a, b) => a.number - b.number);
  const ready = board.open
    .filter((o) => o.status === "ready")
    .sort((a, b) => Date.parse(b.readyAt ?? b.statusAt) - Date.parse(a.readyAt ?? a.statusAt));
  const readyKey = ready.map((o) => o.id).join(",");

  // Newcomers get a timestamp (and a chime once the screen runs); gone numbers are forgotten.
  useEffect(() => {
    const ids = readyKey ? readyKey.split(",") : [];
    const fresh = ids.filter((id) => !(id in readySince));
    if (fresh.length === 0 && Object.keys(readySince).length === ids.length) return;
    if (fresh.length && started) playChime();
    const stamp = started ? Date.now() : 0;
    setReadySince(Object.fromEntries(ids.map((id) => [id, readySince[id] ?? stamp])));
  }, [readyKey, started, readySince]);

  // Keep the display awake while the screen runs (re-acquired when the tab comes back).
  useEffect(() => {
    if (!started) return;
    const acquire = async () => {
      try {
        wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported or refused: the screen still works, it may just dim.
      }
    };
    void acquire();
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLock.current?.release().catch(() => undefined);
    };
  }, [started]);

  function start() {
    // Show the screen at once; sound and full screen are best-effort and must never block it
    // (a display without speakers can leave audio start-up pending for ever).
    // Numbers already ready when the screen starts are not news: no ring, no chime.
    setReadySince((prev) => Object.fromEntries(Object.keys(prev).map((id) => [id, 0])));
    setStarted(true);
    void unlockSound();
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3 lg:px-10">
        <p className="truncate font-display text-xl font-bold lg:text-2xl">{shopName}</p>
        <div className="flex items-center gap-5 text-muted-foreground">
          <span className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "size-2 rotate-45 rounded-[1px]",
                live === "live" ? "bg-state-ready" : "bg-muted-foreground/50",
              )}
            />
            {live === "live" ? t("live") : t("offline")}
          </span>
          <time
            className="font-display text-xl font-semibold tabular-nums lg:text-2xl"
            dateTime={new Date(now).toISOString()}
          >
            {format.dateTime(new Date(now), { hour: "2-digit", minute: "2-digit", timeZone })}
          </time>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_2fr]">
        <section
          aria-labelledby="screen-preparing"
          className="flex min-h-0 flex-col gap-6 border-e p-6 lg:p-10"
        >
          <h2
            id="screen-preparing"
            className="flex items-center gap-3 text-xl font-semibold text-muted-foreground lg:text-3xl"
          >
            <span aria-hidden className="size-3 rotate-45 rounded-[1px] bg-state-preparing" />
            {t("preparing")}
          </h2>
          {preparing.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] content-start gap-x-6 gap-y-4">
              {preparing.map((o) => (
                <li key={o.id} className="order-number text-5xl text-muted-foreground lg:text-6xl">
                  {o.number}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-muted-foreground">{t("nonePreparing")}</p>
          )}
        </section>

        <section
          aria-labelledby="screen-ready"
          aria-live="polite"
          className="flex min-h-0 flex-col gap-6 bg-state-ready p-6 text-state-ready-foreground lg:p-10"
        >
          <h2 id="screen-ready" className="flex items-center gap-3 text-xl font-bold lg:text-3xl">
            <span aria-hidden className="band-rule w-16 opacity-70" />
            {t("ready")}
          </h2>
          {ready.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] content-start gap-6">
              {ready.map((o) => {
                const since = readySince[o.id] ?? 0;
                const fresh = started && since > 0 && now - since < FRESH_MS;
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "rounded-2xl py-3 text-center order-number text-7xl lg:text-8xl",
                      fresh &&
                        "bg-white/15 ring-4 ring-white/70 motion-safe:animate-[ready-halo_2.4s_ease-out_infinite]",
                    )}
                  >
                    {o.number}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-lg opacity-85">{t("noneReady")}</p>
          )}
        </section>
      </main>

      {!started ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-6 backdrop-blur-sm">
          <div className="flex max-w-md flex-col items-center gap-5 text-center">
            <MonitorSpeaker className="size-10 text-muted-foreground" aria-hidden />
            <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("startHint")}</p>
            <Button size="lg" className="h-12 px-6 text-base" onClick={start}>
              <Maximize className="size-5" aria-hidden />
              {t("start")}
            </Button>
            <Link
              href="/dashboard/orders"
              className="text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t("back")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
