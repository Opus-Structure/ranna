import type { I18nText, OrderItemOptionSnapshot } from "@/lib/db/schema/types";
import type { PublicCategory, PublicItem } from "@/lib/shop/public";

/** What the customer sends: references only. Prices are never taken from the client. */
export type CartLine = {
  itemId: string;
  quantity: number;
  optionIds: string[];
  note?: string | null;
};

export type PricedLine = {
  itemId: string;
  name: string;
  nameI18n: I18nText;
  unitPriceMinor: number;
  quantity: number;
  options: OrderItemOptionSnapshot[];
  lineTotalMinor: number;
  note: string | null;
};

export type PricingError =
  | "empty"
  | "too_many_lines"
  | "quantity"
  | "item_unavailable"
  | "option_invalid"
  | "option_unavailable"
  | "option_required"
  | "too_many_options"
  | "total_too_large";

export type PricingResult =
  | { ok: true; lines: PricedLine[]; subtotalMinor: number; totalMinor: number }
  | { ok: false; error: PricingError; itemId?: string };

export const MAX_LINES = 30;
export const MAX_QUANTITY = 50;
const MAX_TOTAL_MINOR = 100_000_000; // 1,000,000 in a 2-decimal currency

export function indexMenu(menu: PublicCategory[]): Map<string, PublicItem> {
  return new Map(menu.flatMap((c) => c.items.map((i) => [i.id, i] as const)));
}

/** Validates one line's options against the item's groups and returns its unit price. */
export function priceLine(
  item: PublicItem,
  optionIds: string[],
):
  | { ok: true; unitPriceMinor: number; options: OrderItemOptionSnapshot[] }
  | { ok: false; error: PricingError } {
  const chosen = new Set(optionIds);
  if (chosen.size !== optionIds.length) return { ok: false, error: "option_invalid" };
  const known = new Set(item.optionGroups.flatMap((g) => g.options.map((o) => o.id)));
  for (const id of chosen) if (!known.has(id)) return { ok: false, error: "option_invalid" };

  let unit = item.priceMinor;
  const snapshot: OrderItemOptionSnapshot[] = [];
  for (const group of item.optionGroups) {
    const picked = group.options.filter((o) => chosen.has(o.id));
    if (picked.length < group.minSelect) return { ok: false, error: "option_required" };
    if (picked.length > group.maxSelect) return { ok: false, error: "too_many_options" };
    for (const o of picked) {
      if (!o.isAvailable) return { ok: false, error: "option_unavailable" };
      unit += o.priceDeltaMinor;
      snapshot.push({
        groupName: group.name,
        optionName: o.name,
        optionNameI18n: o.nameI18n,
        priceDeltaMinor: o.priceDeltaMinor,
      });
    }
  }
  return { ok: true, unitPriceMinor: Math.max(0, unit), options: snapshot };
}

/**
 * Prices a cart from the current menu: every item must exist and be available, every option
 * must belong to the item and respect its group's min/max. Names and prices are snapshotted so
 * later menu edits never change a placed order.
 */
export function priceOrder(
  menu: PublicCategory[] | Map<string, PublicItem>,
  cart: CartLine[],
): PricingResult {
  if (cart.length === 0) return { ok: false, error: "empty" };
  if (cart.length > MAX_LINES) return { ok: false, error: "too_many_lines" };
  const items = menu instanceof Map ? menu : indexMenu(menu);
  const lines: PricedLine[] = [];
  let subtotal = 0;
  for (const line of cart) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      return { ok: false, error: "quantity", itemId: line.itemId };
    }
    const item = items.get(line.itemId);
    if (!item || !item.isAvailable)
      return { ok: false, error: "item_unavailable", itemId: line.itemId };
    const priced = priceLine(item, line.optionIds);
    if (!priced.ok) return { ok: false, error: priced.error, itemId: line.itemId };
    const lineTotal = priced.unitPriceMinor * line.quantity;
    subtotal += lineTotal;
    lines.push({
      itemId: item.id,
      name: item.name,
      nameI18n: item.nameI18n,
      unitPriceMinor: priced.unitPriceMinor,
      quantity: line.quantity,
      options: priced.options,
      lineTotalMinor: lineTotal,
      note: line.note?.trim() ? line.note.trim() : null,
    });
  }
  if (subtotal > MAX_TOTAL_MINOR) return { ok: false, error: "total_too_large" };
  // v1: payment at the counter, no fees or discounts, so the total equals the subtotal.
  return { ok: true, lines, subtotalMinor: subtotal, totalMinor: subtotal };
}
