"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boardAction } from "@/app/(console)/[locale]/dashboard/orders/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Board } from "./board";
import type { LiveState } from "./use-order-live";

const POLL_MS = 20_000;
const DEBOUNCE_MS = 250;

/**
 * Keeps the order board current. Postgres changes on `orders` (filtered to the shop and
 * authorized by RLS with the signed-in user's session) only signal "something changed"; the
 * board is then re-read through the server, so it never trusts row data from the socket.
 * Polling every 20 s and on focus covers dropped sockets (D47).
 */
export function useBoardLive(merchantId: string, initial: Board) {
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
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let stopped = false;
    (async () => {
      // Join as the signed-in member, not as anon: RLS decides which changes reach us, and
      // anon sees none. The session loads from cookies asynchronously, so wait for it first.
      const { data } = await supabase.auth.getSession();
      if (stopped) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (stopped) return;
      // A topic per mount: two channels sharing a topic on one socket would let the leave of
      // the old one (remount, hot reload, a second board tab) cancel the live one's changes.
      channel = supabase
        .channel(`board:${merchantId}:${crypto.randomUUID().slice(0, 8)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchantId}` },
          soon,
        )
        .subscribe((state) => {
          setLive(
            state === "SUBSCRIBED"
              ? "live"
              : state === "CLOSED" || state === "CHANNEL_ERROR"
                ? "offline"
                : "connecting",
          );
          // Catch up on anything missed while the socket was down.
          if (state === "SUBSCRIBED") soon();
        });
    })().catch(() => setLive("offline"));
    return () => {
      stopped = true;
      window.clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [merchantId, soon]);

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
