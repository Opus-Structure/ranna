"use client";

import { createContext, useContext, type CSSProperties } from "react";

/**
 * Sheets render in a portal outside the themed shop root, so they re-apply the merchant's
 * variables and face from here.
 */
export type ShopThemeValue = { style: CSSProperties; fontClass: string };

const ShopThemeContext = createContext<ShopThemeValue>({ style: {}, fontClass: "" });

export const ShopThemeProvider = ShopThemeContext.Provider;

export function useShopTheme(): ShopThemeValue {
  return useContext(ShopThemeContext);
}

export const SHOP_INK_VARS = {
  "--shop-ink": "#1f1a17",
  "--shop-muted": "#625a55",
  "--shop-line": "#e8e3de",
  "--shop-card": "#ffffff",
} as const;
