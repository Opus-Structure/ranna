import { accountAccess, type AccountStatus } from "@/lib/billing/state-machine";
import type { OpeningHoursDay } from "@/lib/db/schema/types";
import { isWithinHours, nextOpening } from "./hours";

export type StorefrontStatus = {
  /** The page is published at all (account active or in grace). */
  live: boolean;
  /** Customers may place an order right now. */
  canOrder: boolean;
  tone: "open" | "paused" | "closed";
  reason: "open" | "paused" | "closed_toggle" | "outside_hours";
  next: { day: number; time: string; today: boolean } | null;
};

/**
 * One rule for "can a customer order now?", used by the page and (phase 5) by the server
 * when an order arrives: account live, shop switched open, inside posted hours, taking orders.
 */
export function storefrontStatus(
  shop: {
    status: AccountStatus;
    graceUntil: Date | string | null;
    isOpen: boolean;
    acceptingOrders: boolean;
    openingHours: OpeningHoursDay[] | undefined;
    timezone: string;
  },
  at: Date,
): StorefrontStatus {
  const graceUntil = shop.graceUntil ? new Date(shop.graceUntil) : null;
  const live = accountAccess({ status: shop.status, graceUntil }, at).shopLive;
  const closed = (reason: StorefrontStatus["reason"]): StorefrontStatus => ({
    live,
    canOrder: false,
    tone: "closed",
    reason,
    next: nextOpening(shop.openingHours, shop.timezone, at),
  });
  if (!live) return closed("closed_toggle");
  if (!shop.isOpen) return closed("closed_toggle");
  if (!isWithinHours(shop.openingHours, shop.timezone, at)) return closed("outside_hours");
  if (!shop.acceptingOrders)
    return { live, canOrder: false, tone: "paused", reason: "paused", next: null };
  return { live, canOrder: true, tone: "open", reason: "open", next: null };
}
