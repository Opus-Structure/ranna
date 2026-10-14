/** Order lifecycle. Staff move orders forward; "Ready" rings the customer. */
export const ORDER_STATUSES = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "canceled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const allowed: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["accepted", "preparing", "ready", "canceled"],
  accepted: ["preparing", "ready", "canceled"],
  preparing: ["ready", "canceled"],
  // Back to preparing undoes a mistaken "Ready" before the customer arrives.
  ready: ["completed", "preparing", "canceled"],
  completed: [],
  canceled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowed[from].includes(to);
}

export function nextActions(from: OrderStatus): readonly OrderStatus[] {
  return allowed[from];
}

export function isOpenOrder(status: OrderStatus): boolean {
  return status !== "completed" && status !== "canceled";
}

/** The timestamp column a transition stamps. */
export function timestampFor(to: OrderStatus) {
  switch (to) {
    case "accepted":
      return "acceptedAt" as const;
    case "preparing":
      return "preparingAt" as const;
    case "ready":
      return "readyAt" as const;
    case "completed":
      return "completedAt" as const;
    case "canceled":
      return "canceledAt" as const;
    default:
      return null;
  }
}

/** What the customer sees: three steps, plus the two endings. */
export type CustomerStage = "received" | "preparing" | "ready" | "collected" | "canceled";

export function customerStage(status: OrderStatus): CustomerStage {
  switch (status) {
    case "new":
    case "accepted":
      return "received";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "completed":
      return "collected";
    case "canceled":
      return "canceled";
  }
}
