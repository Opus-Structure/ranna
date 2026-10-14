"use client";

import { useEffect, useState } from "react";
import type { CustomerOrderStatus } from "./service";

export type LiveState = "live" | "connecting" | "offline";

/**
 * Keeps an order's status current: a Realtime Broadcast subscription for instant updates,
 * plus polling every 15 s and on focus/visibility/online, because cheap phones and patchy 4G
 * drop sockets (D5). Realtime is loaded after hydration so it never delays the first paint.
 */
export function useOrderLive(token: string, topic: string, initial: CustomerOrderStatus) {
  const [status, setStatus] = useState(initial);
  const [live, setLive] = useState<LiveState>("connecting");

  useEffect(() => {
    let stopped = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return;
      const { RealtimeClient } = await import("@supabase/realtime-js");
      if (stopped) return;
      const client = new RealtimeClient(`${url.replace(/^http/, "ws")}/realtime/v1`, {
        params: { apikey: key },
      });
      const channel = client.channel(topic, { config: { broadcast: { self: false } } });
      channel
        .on("broadcast", { event: "status" }, (message) => {
          setStatus(message.payload as CustomerOrderStatus);
        })
        .subscribe((state) =>
          setLive(state === "SUBSCRIBED" ? "live" : state === "CLOSED" ? "offline" : "connecting"),
        );
      cleanup = () => {
        void channel.unsubscribe();
        void client.disconnect();
      };
    })().catch(() => setLive("offline"));
    return () => {
      stopped = true;
      cleanup?.();
    };
  }, [topic]);

  useEffect(() => {
    let inFlight = false;
    const poll = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
        if (res.ok) setStatus((await res.json()) as CustomerOrderStatus);
      } catch {
        setLive("offline");
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(poll, 15_000);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", poll);
    window.addEventListener("focus", poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", poll);
      window.removeEventListener("focus", poll);
    };
  }, [token]);

  return { status, live };
}
