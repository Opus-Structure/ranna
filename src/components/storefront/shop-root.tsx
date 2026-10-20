import type { CSSProperties, ReactNode } from "react";
import { shopFontClass } from "@/app/shop-fonts";
import { SHOP_INK_VARS } from "@/lib/branding/shop-ink";
import type { ShopTheme } from "@/lib/branding/theme";
import { cn } from "@/lib/utils";

/**
 * The merchant's world: brand variables, chosen face, and our neutral ink on a warm-white
 * ground. Everything inside reads colours from these variables only.
 */
export function ShopRoot({
  theme,
  className,
  children,
}: {
  theme: ShopTheme;
  className?: string;
  children: ReactNode;
}) {
  const style = {
    ...theme.vars,
    ...SHOP_INK_VARS,
  } as CSSProperties;
  return (
    <div
      style={style}
      className={cn(
        shopFontClass[theme.font],
        "min-h-full bg-[var(--shop-ground)] text-[var(--shop-ink)] antialiased",
        "[--band-empty:var(--shop-line)] [--band-ink:var(--brand-ink)]",
        "selection:bg-[color-mix(in_oklch,var(--brand)_25%,transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
