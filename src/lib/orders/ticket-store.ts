"use client";

import { useCallback, useSyncExternalStore } from "react";

/** One line on the customer's ticket. Only references: prices are computed for display only. */
export type TicketLine = {
  key: string;
  itemId: string;
  quantity: number;
  optionIds: string[];
  note: string | null;
};

export type RecentOrder = { token: string; slug: string; number: number; placedAt: string };

const ticketKey = (slug: string) => `ranna:ticket:${slug}`;
const ORDERS_KEY = "ranna:orders";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage: the ticket lives in memory for this visit.
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function write(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage unavailable; keep the in-memory copy.
  }
  cache.set(key, { raw, value });
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: TicketLine[] = [];

/** The ticket for one shop, shared by every component on the page and persisted on the device. */
export function useTicket(slug: string) {
  const lines = useSyncExternalStore(
    subscribe,
    () => read<TicketLine[]>(ticketKey(slug), EMPTY),
    () => EMPTY,
  );
  const set = useCallback((next: TicketLine[]) => write(ticketKey(slug), next), [slug]);

  return {
    lines,
    add: (line: Omit<TicketLine, "key">) => {
      // Same dish with the same choices and note: increase the quantity instead of a new line.
      const same = lines.find(
        (l) =>
          l.itemId === line.itemId &&
          l.note === line.note &&
          [...l.optionIds].sort().join() === [...line.optionIds].sort().join(),
      );
      if (same)
        set(
          lines.map((l) =>
            l === same ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l,
          ),
        );
      else set([...lines, { ...line, key: crypto.randomUUID() }]);
    },
    setQuantity: (key: string, quantity: number) =>
      set(
        quantity <= 0
          ? lines.filter((l) => l.key !== key)
          : lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l)),
      ),
    remove: (key: string) => set(lines.filter((l) => l.key !== key)),
    clear: () => set([]),
  };
}

const NO_ORDERS: RecentOrder[] = [];

/** Orders placed from this device, so a customer who closes the tab can find theirs again. */
export function useRecentOrders() {
  return useSyncExternalStore(
    subscribe,
    () => read<RecentOrder[]>(ORDERS_KEY, NO_ORDERS),
    () => NO_ORDERS,
  );
}

export function rememberOrder(order: RecentOrder) {
  const existing = read<RecentOrder[]>(ORDERS_KEY, NO_ORDERS).filter(
    (o) => o.token !== order.token,
  );
  // Keep the last 10, newest first.
  write(ORDERS_KEY, [order, ...existing].slice(0, 10));
}
