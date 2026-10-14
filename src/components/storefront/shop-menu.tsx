"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import type { ShopLayout } from "@/lib/db/schema/types";
import { pickOptional, pickText, searchKey } from "@/lib/i18n/pick";
import { formatMoney } from "@/lib/money";
import type { PublicCategory, PublicItem } from "@/lib/shop/public";
import { assetUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";

/**
 * The menu: sticky section chips that follow the scroll, an accent- and diacritic-insensitive
 * search, and items as rows or a photo grid. `onSelect` makes items tappable (ordering).
 */
export function ShopMenu({
  categories,
  layout,
  currency,
  onSelect,
  stickyTop = 0,
}: {
  categories: PublicCategory[];
  layout: ShopLayout;
  currency: string;
  onSelect?: (item: PublicItem) => void;
  /** Offset for the sticky bar, e.g. inside the editor's phone frame. */
  stickyTop?: number;
}) {
  const t = useTranslations("storefront");
  const locale = useLocale() as AppLocale;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const deferred = useDeferredValue(query);
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const chipsRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const key = searchKey(deferred);
    if (!key) return categories;
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) =>
          searchKey(
            `${pickText(i.name, i.nameI18n, locale)} ${i.name} ${pickOptional(i.description, i.descriptionI18n, locale) ?? ""}`,
          ).includes(key),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, deferred, locale]);

  // Scroll-spy: the chip of the section under the sticky bar is the active one.
  useEffect(() => {
    if (searching) return;
    const sections = categories
      .map((c) => document.getElementById(`cat-${c.id}`))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.slice(4));
      },
      { rootMargin: "-72px 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories, searching]);

  // Keep the active chip visible without moving the page.
  useEffect(() => {
    const bar = chipsRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (!bar || !chip) return;
    const target = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
    bar.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  if (categories.length === 0) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-center text-[var(--shop-muted)]">
        {t("emptyMenu")}
      </p>
    );
  }

  return (
    <>
      <nav
        aria-label={t("categories")}
        className="sticky z-20 border-b border-[var(--shop-line)] bg-[var(--shop-ground)]"
        style={{ top: stickyTop }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          {searching ? (
            <div className="flex flex-1 items-center gap-2">
              <Search className="size-5 shrink-0 text-[var(--shop-muted)]" aria-hidden />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                aria-label={t("search.placeholder")}
                className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--shop-muted)]"
              />
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearching(false);
                }}
                aria-label={t("search.clear")}
                className="grid size-11 place-items-center rounded-full hover:bg-[var(--shop-line)] focus-visible:outline-2 focus-visible:outline-[var(--brand-ink)]"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <div
                ref={chipsRef}
                className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-2"
              >
                {categories.map((c) => (
                  <a
                    key={c.id}
                    href={`#cat-${c.id}`}
                    data-cat={c.id}
                    aria-current={active === c.id ? "true" : undefined}
                    onClick={() => setActive(c.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
                      active === c.id
                        ? "border-[var(--brand-ink)] text-[var(--brand-ink)]"
                        : "border-transparent text-[var(--shop-muted)] hover:text-[var(--shop-ink)]",
                    )}
                  >
                    {pickText(c.name, c.nameI18n, locale)}
                  </a>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSearching(true)}
                aria-label={t("search.open")}
                className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-[var(--shop-line)] focus-visible:outline-2 focus-visible:outline-[var(--brand-ink)]"
              >
                <Search className="size-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 pb-36">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-[var(--shop-muted)]" role="status">
            {t("search.noResults", { query })}
          </p>
        ) : (
          visible.map((c) => (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              aria-labelledby={`h-${c.id}`}
              className="scroll-mt-16 pt-7"
            >
              <h2 id={`h-${c.id}`} className="mb-1 text-xl font-bold">
                {pickText(c.name, c.nameI18n, locale)}
              </h2>
              <div aria-hidden className="mb-2 band-rule w-16 text-[var(--brand-ink)]" />
              <ul
                className={cn(layout === "grid" ? "grid grid-cols-2 gap-3 pt-2" : "flex flex-col")}
              >
                {c.items.map((item) => (
                  <li key={item.id}>
                    <MenuItemCard
                      item={item}
                      layout={layout}
                      currency={currency}
                      locale={locale}
                      onSelect={onSelect}
                      soldOut={t("soldOut")}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}

function MenuItemCard({
  item,
  layout,
  currency,
  locale,
  onSelect,
  soldOut,
}: {
  item: PublicItem;
  layout: ShopLayout;
  currency: string;
  locale: AppLocale;
  onSelect?: (item: PublicItem) => void;
  soldOut: string;
}) {
  const name = pickText(item.name, item.nameI18n, locale);
  const description = pickOptional(item.description, item.descriptionI18n, locale);
  const image = assetUrl(item.imagePath);
  const price = formatMoney(item.priceMinor, currency, locale);
  const interactive = Boolean(onSelect) && item.isAvailable;
  const Tag = interactive ? "button" : "div";

  if (layout === "grid") {
    return (
      <Tag
        {...(interactive ? { type: "button" as const, onClick: () => onSelect!(item) } : {})}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-2xl bg-[var(--shop-card)] text-start shadow-[0_1px_3px_rgb(31_26_23/0.08)]",
          interactive &&
            "transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)] active:scale-[0.98]",
          !item.isAvailable && "opacity-60",
        )}
      >
        <div className="relative aspect-[4/3] w-full bg-[var(--shop-line)]">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 672px) 50vw, 330px"
              className="object-cover"
            />
          ) : null}
          {!item.isAvailable ? (
            <span className="absolute start-2 top-2 rounded-full bg-[var(--shop-ink)] px-2 py-0.5 text-xs font-semibold text-white">
              {soldOut}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span className="leading-snug font-semibold">{name}</span>
          <span className="mt-auto pt-1 font-semibold text-[var(--brand-ink)] tabular-nums">
            {price}
          </span>
        </div>
      </Tag>
    );
  }

  return (
    <Tag
      {...(interactive ? { type: "button" as const, onClick: () => onSelect!(item) } : {})}
      className={cn(
        "flex w-full items-start gap-4 border-b border-[var(--shop-line)] py-4 text-start",
        interactive &&
          "-mx-2 rounded-xl px-2 transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--brand-ink)]",
        !item.isAvailable && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[1.0625rem] leading-snug font-semibold">{name}</span>
        {description ? (
          <span className="line-clamp-2 text-sm leading-relaxed text-[var(--shop-muted)]">
            {description}
          </span>
        ) : null}
        <span className="mt-1 flex items-center gap-2">
          <span className="font-semibold text-[var(--brand-ink)] tabular-nums">{price}</span>
          {!item.isAvailable ? (
            <span className="rounded-full bg-[var(--shop-line)] px-2 py-0.5 text-xs font-semibold">
              {soldOut}
            </span>
          ) : null}
        </span>
      </div>
      {image ? (
        <Image
          src={image}
          alt=""
          width={96}
          height={96}
          sizes="96px"
          className="size-24 shrink-0 rounded-xl object-cover"
        />
      ) : null}
    </Tag>
  );
}
