"use client";

import { useEffect, useRef, useState } from "react";
import type { SealedLiveQuery } from "@neon/realtime/client";
import { watchLiveQuery } from "@/lib/realtime/subscribe";
import type { OrderPulse } from "@/lib/realtime/live";
import type { CustomerOrderStatus } from "./service";

export type LiveState = "live" | "connecting" | "offline";

/**
 * Keeps an order's status current: a Neon Realtime live query on this one order (sealed by the
 * server for whoever holds the token) tells the page the moment the row changes, and the page
 * then re-reads the status through the API. Polling (15 s by default) and focus/visibility/
 * online checks stay as the fallback, because cheap phones and patchy 4G drop sockets (D5).
 * Realtime is loaded after hydration so it never delays the first paint.
 */
export function useOrderLive(token: string, initial: CustomerOrderStatus, pollMs = 15_000) {
  const [status, setStatus] = useState(initial);
  const [live, setLive] = useState<LiveState>("connecting");
  /** Set when staff tap "Ring again": restarts the alarm even after "I'm coming". */
  const [ringAt, setRingAt] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const lastRung = useRef<string | null>(null);

  useEffect(() => {
    let inFlight = false;
    let again = false;
    const refresh = async () => {
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      try {
        do {
          again = false;
          const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
          if (res.ok) setStatus((await res.json()) as CustomerOrderStatus);
        } while (again);
      } catch {
        setLive("offline");
      } finally {
        inFlight = false;
      }
    };
    refreshRef.current = refresh;
    return () => {
      refreshRef.current = async () => undefined;
    };
  }, [token]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let stopped = false;
    watchLiveQuery<OrderPulse>(
      async () => {
        const res = await fetch(`/api/orders/${token}/live`, { method: "POST", cache: "no-store" });
        return res.ok ? ((await res.json()) as SealedLiveQuery<OrderPulse>) : null;
      },
      (snapshot) => {
        setLive(
          snapshot.status === "live" || snapshot.status === "stale"
            ? "live"
            : snapshot.status === "connecting"
              ? "connecting"
              : "offline",
        );
        const row = snapshot.data?.[0];
        if (!row) return;
        // "Ring again" bumps last_rung_at: restart the alarm even if they already said "coming".
        const rung = row.last_rung_at ? new Date(row.last_rung_at).toISOString() : null;
        if (rung && lastRung.current && rung !== lastRung.current) {
          setRingAt(rung);
          setStatus((s) => ({ ...s, acknowledgedAt: null }));
        }
        lastRung.current = rung;
        void refreshRef.current();
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
      stop?.();
    };
  }, [token]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "hidden") return;
      void refreshRef.current();
    };
    const timer = window.setInterval(poll, pollMs);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", poll);
    window.addEventListener("focus", poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", poll);
      window.removeEventListener("focus", poll);
    };
  }, [pollMs]);

  return { status, setStatus, live, ringAt };
}
