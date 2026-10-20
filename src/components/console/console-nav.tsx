"use client";

import {
  BadgeCheck,
  BookOpenText,
  ChartLine,
  ChefHat,
  ConciergeBell,
  CreditCard,
  Layers,
  LayoutGrid,
  QrCode,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const icons = {
  overview: LayoutGrid,
  orders: ConciergeBell,
  kitchen: ChefHat,
  menu: BookOpenText,
  shop: Store,
  qr: QrCode,
  staff: Users,
  billing: CreditCard,
  settings: Settings2,
  admin: ShieldCheck,
  merchants: Store,
  payments: BadgeCheck,
  plans: Layers,
  metrics: ChartLine,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof icons;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Live count shown at the end of the item (e.g. new orders). */
  badge?: number;
  /** Exact match only (for index routes like /dashboard). */
  exact?: boolean;
};

export function ConsoleNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = icons[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-11 items-center gap-3 rounded-lg ps-3.5 pe-3 text-ui transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-clay-foreground",
                  active
                    ? "bg-[color-mix(in_oklch,var(--clay-foreground)_13%,transparent)] font-semibold text-clay-foreground"
                    : "text-clay-muted hover:bg-clay-hover hover:text-clay-foreground",
                )}
              >
                {/* The active marker: one lozenge on the band's 45° lattice. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute start-[3px] size-1.5 rotate-45 rounded-[1px] bg-current transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className="min-w-6 rounded-full bg-state-new px-1.5 text-center text-xs leading-6 font-bold text-state-new-foreground"
                    data-numeric
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
