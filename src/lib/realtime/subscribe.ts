"use client";

import {
  createRealtimeClient,
  type LiveQuerySnapshot,
  type RealtimeClient,
  type SealedLiveQuery,
} from "@neon/realtime/client";

/** Sealed queries live about a minute; renew a little before they lapse. */
const RENEW_EARLY_MS = 10_000;
const RETRY_MS = 1_000;

let client: RealtimeClient | undefined;

function getClient(): RealtimeClient | null {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (!url) return null;
  client ??= createRealtimeClient({ url });
  return client;
}

export type LiveStatus = LiveQuerySnapshot<unknown>["status"];

/**
 * Subscribes to a live query the server sealed for this page and keeps it renewed. `fetchSealed`
 * asks our own API for a fresh capability (which re-checks who is asking). Returns a stop
 * function; resolves to null when Realtime isn't configured or the first seal fails, so the
 * caller keeps polling.
 */
export async function watchLiveQuery<Row>(
  fetchSealed: () => Promise<SealedLiveQuery<Row> | null>,
  onSnapshot: (snapshot: LiveQuerySnapshot<Row>) => void,
): Promise<(() => void) | null> {
  const rt = getClient();
  if (!rt) return null;
  const first = await fetchSealed();
  if (!first) return null;

  const subscription = rt.subscribe<Row>(first);
  subscription.onChange(onSnapshot);

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (ms: number) => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(renew, ms);
  };
  const scheduleFor = (expiresAt: number) =>
    schedule(Math.max(0, expiresAt - Date.now() - RENEW_EARLY_MS));
  async function renew() {
    let next: SealedLiveQuery<Row> | null = null;
    try {
      next = await fetchSealed();
    } catch {
      next = null;
    }
    if (!next) return schedule(RETRY_MS);
    scheduleFor(next.expiresAt);
    subscription.renew(next).catch(() => undefined);
  }
  scheduleFor(first.expiresAt);

  return () => {
    stopped = true;
    clearTimeout(timer);
    subscription.unsubscribe();
  };
}
