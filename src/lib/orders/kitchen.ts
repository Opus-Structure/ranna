/** Kitchen routing: where a new order goes besides the order board. Pure, shared by server and client. */
export const KITCHEN_ROUTING = ["none", "print", "screen", "both"] as const;
export type KitchenRouting = (typeof KITCHEN_ROUTING)[number];
export const TICKET_WIDTHS = [58, 80] as const;
export type TicketWidth = (typeof TICKET_WIDTHS)[number];

export type KitchenConfig = { routing: KitchenRouting; ticketWidthMm: TicketWidth };

export function kitchenConfig(settings: {
  kitchenRouting?: string;
  ticketWidthMm?: number;
}): KitchenConfig {
  const routing = (KITCHEN_ROUTING as readonly string[]).includes(settings.kitchenRouting ?? "")
    ? (settings.kitchenRouting as KitchenRouting)
    : "none";
  return { routing, ticketWidthMm: settings.ticketWidthMm === 58 ? 58 : 80 };
}

export const routesToPrint = (r: KitchenRouting) => r === "print" || r === "both";
export const routesToScreen = (r: KitchenRouting) => r === "screen" || r === "both";

/** Orders the kitchen cooks: new and accepted (waiting) plus preparing, oldest first. */
export function kitchenQueue<T extends { status: string; placedAt: string }>(open: T[]): T[] {
  return open
    .filter((o) => o.status === "new" || o.status === "accepted" || o.status === "preparing")
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt));
}

/** Adds an id to the remembered "already printed" list, newest last, capped. */
export function rememberId(list: readonly string[], id: string, max = 200): string[] {
  const next = list.includes(id) ? [...list] : [...list, id];
  return next.length > max ? next.slice(next.length - max) : next;
}
