"use client";

import { useState, type CSSProperties } from "react";
import type { ShopLayout } from "@/lib/db/schema/types";
import { useTicket } from "@/lib/orders/ticket-store";
import type { PublicCategory, PublicItem } from "@/lib/shop/public";
import { ShopMenu } from "../shop-menu";
import { ItemSheet } from "./item-sheet";
import { SHOP_INK_VARS } from "@/lib/branding/shop-ink";
import { ShopThemeProvider } from "./shop-theme-context";
import { Ticket } from "./ticket";

/** The interactive part of the shop page: menu → dish sheet → ticket → order. */
export function OrderApp({
  slug,
  menu,
  layout,
  currency,
  canOrder,
  closedLabel,
  askPhone,
  table,
  themeVars,
  fontClass,
}: {
  slug: string;
  menu: PublicCategory[];
  layout: ShopLayout;
  currency: string;
  canOrder: boolean;
  closedLabel: string;
  askPhone: boolean;
  table: { code: string; label: string } | null;
  themeVars: Record<string, string>;
  fontClass: string;
}) {
  const [selected, setSelected] = useState<PublicItem | null>(null);
  const ticket = useTicket(slug);
  const style = { ...themeVars, ...SHOP_INK_VARS } as CSSProperties;

  return (
    <ShopThemeProvider value={{ style, fontClass }}>
      <ShopMenu categories={menu} layout={layout} currency={currency} onSelect={setSelected} />
      <ItemSheet
        item={selected}
        currency={currency}
        canOrder={canOrder}
        closedLabel={closedLabel}
        onClose={() => setSelected(null)}
        onAdd={(line) => {
          ticket.add(line);
          setSelected(null);
        }}
      />
      <Ticket
        slug={slug}
        menu={menu}
        currency={currency}
        canOrder={canOrder}
        closedLabel={closedLabel}
        askPhone={askPhone}
        table={table}
      />
    </ShopThemeProvider>
  );
}
