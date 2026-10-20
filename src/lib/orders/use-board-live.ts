"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boardAction } from "@/app/(console)/[locale]/dashboard/orders/actions";
import type { SealedLiveQuery } from "@neon/realtime/client";
import type { BoardPulse } from "@/lib/realtime/live";
import { watchLiveQuery } from "@/lib/realtime/subscribe";
import type { Board } from "./board";
import type { LiveState } from "./use-order-live";

const POLL_MS = 20_000;
const DEBOUNCE_MS = 250;

/**
 * Keeps the order board current. A Neon Realtime live query over the shop's latest orders (sealed
 * by the server for the signed-in member only) signals "something changed"; the board is then
 * re-read through the server, so it never trusts row data from the socket. Polling every 20 s
 * and on focus covers dropped sockets (D47).
 */
export function useBoardLive(initial: Board) {
  const [board, setBoard] = useState(initial);
  const [live, setLive] = useState<LiveState>("connecting");
  const inFlight = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        const next = await boardAction();
        if (next) setBoard(next);
      } while (again.current);
    } catch {
      setLive("offline");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const soon = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void refresh(), DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let stopped = false;
    // The first snapshot is the current state, not news: only later changes trigger a re-read.
    let seen = false;
    watchLiveQuery<BoardPulse>(
      async () => {
        const res = await fetch("/api/orders/live", { method: "POST", cache: "no-store" });
        return res.ok ? ((await res.json()) as SealedLiveQuery<BoardPulse>) : null;
      },
      (snapshot) => {
        setLive(
          snapshot.status === "live" || snapshot.status === "stale"
            ? "live"
            : snapshot.status === "connecting"
              ? "connecting"
              : "offline",
        );
        if (!snapshot.data) return;
        if (seen) soon();
        seen = true;
      },
    )
      .then((cleanup) => {
        if (stopped) cleanup?.();
        else stop = cleanup;
        if (!cleanup) setLive("offline");
      })
      .catch(() => setLive("offline"));
    return () => {
      stopped = true;
      window.clearTimeout(timer.current);
      stop?.();
    };
  }, [soon]);

  useEffect(() => {
    const poll = () => document.visibilityState === "visible" && void refresh();
    const interval = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);
    window.addEventListener("online", poll);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
      window.removeEventListener("online", poll);
    };
  }, [refresh]);

  return { board, setBoard, live, refresh };
}

/**
 * Re-renders every `ms` so waiting times and wait bands advance without new data. The first
 * render uses `initial` (the server's clock when it built the page) so server and client HTML
 * match; the live clock takes over right after hydration.
 */
export function useNow(ms: number, initial: string) {
  const [now, setNow] = useState(() => Date.parse(initial));
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
