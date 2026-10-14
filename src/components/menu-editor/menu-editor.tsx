"use client";

import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createCategoryAction,
  deleteCategoryAction,
  deleteItemAction,
  reorderCategoriesAction,
  reorderItemsAction,
  setItemAvailabilityAction,
  updateCategoryAction,
} from "@/app/(console)/[locale]/dashboard/menu/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AppLocale } from "@/i18n/routing";
import { pickText } from "@/lib/i18n/pick";
import type { MenuCategory, MenuItem } from "@/lib/menu/service";
import { formatMoney } from "@/lib/money";
import { assetUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";
import { ItemSheet, type ItemSheetTarget } from "./item-sheet";
import { SortableList } from "./sortable-list";

type Confirm =
  { kind: "category"; category: MenuCategory } | { kind: "item"; item: MenuItem } | null;

export function MenuEditor({
  initial,
  currency,
  locales,
  defaultLocale,
  usage,
  readOnly,
}: {
  initial: MenuCategory[];
  currency: string;
  locales: AppLocale[];
  defaultLocale: AppLocale;
  usage: { used: number; limit: number };
  readOnly: boolean;
}) {
  const t = useTranslations("menu");
  const tc = useTranslations("common.actions");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [cats, setCats] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    // Server data changed (after a save): adopt it.
    setPrevInitial(initial);
    setCats(initial);
  }
  const [newCategory, setNewCategory] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [sheet, setSheet] = useState<ItemSheetTarget | null>(null);
  const [pending, startTransition] = useTransition();

  function act(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success?: string,
    revert?: () => void,
  ) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          revert?.();
          toast.error(t(`errors.${(result as { error: string }).error}` as "errors.generic"));
          return;
        }
        if (success) toast.success(success);
        router.refresh();
      } catch {
        revert?.();
        toast.error(t("errors.generic"));
      }
    });
  }

  function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    act(async () => {
      const r = await createCategoryAction({ name, nameI18n: {} });
      if (r.ok) setNewCategory("");
      return r;
    });
  }

  function reorderCategories(next: MenuCategory[]) {
    const before = cats;
    setCats(next);
    act(
      () => reorderCategoriesAction(next.map((c) => c.id)),
      t("moved"),
      () => setCats(before),
    );
  }

  function reorderItems(category: MenuCategory, next: MenuItem[]) {
    const before = cats;
    setCats(cats.map((c) => (c.id === category.id ? { ...c, items: next } : c)));
    act(
      () =>
        reorderItemsAction(
          category.id,
          next.map((i) => i.id),
        ),
      t("moved"),
      () => setCats(before),
    );
  }

  function toggleAvailability(item: MenuItem, available: boolean) {
    const before = cats;
    setCats(
      cats.map((c) => ({
        ...c,
        items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: available } : i)),
      })),
    );
    act(
      () => setItemAvailabilityAction(item.id, available),
      undefined,
      () => setCats(before),
    );
  }

  function confirmDelete() {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    act(() =>
      target.kind === "category"
        ? deleteCategoryAction(target.category.id)
        : deleteItemAction(target.item.id),
    );
  }

  const atLimit = usage.used >= usage.limit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p
          className={cn(
            "text-sm",
            atLimit ? "font-semibold text-destructive" : "text-muted-foreground",
          )}
          data-numeric
        >
          {t("usage", { used: usage.used, limit: usage.limit })}
        </p>
        <form onSubmit={addCategory} className="flex w-full max-w-md gap-2 sm:w-auto">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            maxLength={60}
            placeholder={t("categoryName")}
            aria-label={t("categoryName")}
            disabled={readOnly}
            className="h-10"
          />
          <Button
            type="submit"
            disabled={readOnly || pending || !newCategory.trim()}
            className="h-10 shrink-0"
          >
            <Plus aria-hidden />
            {t("addCategory")}
          </Button>
        </form>
      </div>

      {cats.length === 0 ? (
        <div className="flex max-w-xl flex-col gap-2 rounded-xl border border-dashed p-8">
          <span aria-hidden className="band-rule w-20 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">{t("empty.title")}</h2>
          <p className="text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SortableList items={cats} onReorder={reorderCategories} disabled={readOnly}>
            {(category, handle) => {
              const name = pickText(category.name, category.nameI18n, locale);
              return (
                <section aria-label={name} className="rounded-xl border bg-card">
                  <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-3">
                    {handle(t("dragHandle", { name }))}
                    {renaming?.id === category.id ? (
                      <form
                        className="flex flex-1 gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const value = renaming.name.trim();
                          setRenaming(null);
                          if (value && value !== category.name) {
                            act(() =>
                              updateCategoryAction(category.id, {
                                name: value,
                                nameI18n: category.nameI18n,
                                isVisible: category.isVisible,
                              }),
                            );
                          }
                        }}
                      >
                        <Input
                          autoFocus
                          value={renaming.name}
                          maxLength={60}
                          aria-label={t("renameCategory")}
                          onChange={(e) => setRenaming({ id: category.id, name: e.target.value })}
                          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                          className="h-10"
                        />
                      </form>
                    ) : (
                      <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">
                        {name}
                        {!category.isVisible ? (
                          <span className="ms-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <EyeOff className="size-3.5" aria-hidden />
                            {t("hidden")}
                          </span>
                        ) : null}
                      </h2>
                    )}
                    <span className="text-sm text-muted-foreground" data-numeric>
                      {category.items.length}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={readOnly}
                          aria-label={`${t("renameCategory")} · ${name}`}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setRenaming({ id: category.id, name: category.name })}
                        >
                          <Pencil aria-hidden />
                          {t("renameCategory")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            act(() =>
                              updateCategoryAction(category.id, {
                                name: category.name,
                                nameI18n: category.nameI18n,
                                isVisible: !category.isVisible,
                              }),
                            )
                          }
                        >
                          {category.isVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                          {category.isVisible ? t("hideCategory") : t("showCategory")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setConfirm({ kind: "category", category })}
                        >
                          <Trash2 aria-hidden />
                          {t("deleteCategory")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </header>

                  {category.items.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">{t("emptyCategory")}</p>
                  ) : (
                    <ul className="divide-y">
                      <SortableList
                        items={category.items}
                        onReorder={(next) => reorderItems(category, next)}
                        disabled={readOnly}
                        as="li"
                        rowClassName="bg-card flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3"
                      >
                        {(item, itemHandle) => {
                          const itemName = pickText(item.name, item.nameI18n, locale);
                          const image = assetUrl(item.imagePath);
                          return (
                            <>
                              {itemHandle(t("dragHandle", { name: itemName }))}
                              <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {image ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- small thumbnail of an uploaded asset
                                  <img
                                    src={image}
                                    alt=""
                                    className="size-full object-cover"
                                    loading="lazy"
                                  />
                                ) : null}
                              </div>
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() =>
                                  setSheet({ mode: "edit", item, categoryId: category.id })
                                }
                                className="flex min-w-0 flex-1 flex-col items-start rounded-md px-1 py-1 text-start focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                <span
                                  className={cn(
                                    "truncate font-medium",
                                    !item.isAvailable && "text-muted-foreground line-through",
                                  )}
                                >
                                  {itemName}
                                </span>
                                <span className="text-sm text-muted-foreground" data-numeric>
                                  {formatMoney(item.priceMinor, currency, locale)}
                                  {item.optionGroups.length
                                    ? ` · ${item.optionGroups.length} ${t("item.groups").toLowerCase()}`
                                    : ""}
                                </span>
                              </button>
                              <label className="flex items-center gap-2 text-sm">
                                <span className="hidden text-muted-foreground sm:inline">
                                  {item.isAvailable ? t("item.available") : t("item.soldOut")}
                                </span>
                                <Switch
                                  checked={item.isAvailable}
                                  disabled={readOnly}
                                  onCheckedChange={(v) => toggleAvailability(item, v)}
                                  aria-label={`${itemName}: ${t("item.available")}`}
                                />
                              </label>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={readOnly}
                                onClick={() => setConfirm({ kind: "item", item })}
                                aria-label={`${t("deleteItem")} · ${itemName}`}
                              >
                                <Trash2 aria-hidden />
                              </Button>
                            </>
                          );
                        }}
                      </SortableList>
                    </ul>
                  )}

                  <div className="border-t px-3 py-2">
                    <Button
                      variant="ghost"
                      disabled={readOnly || atLimit}
                      onClick={() => setSheet({ mode: "new", categoryId: category.id })}
                    >
                      <Plus aria-hidden />
                      {t("addItem")}
                    </Button>
                  </div>
                </section>
              );
            }}
          </SortableList>
        </div>
      )}

      <ItemSheet
        target={sheet}
        onClose={() => setSheet(null)}
        categories={cats}
        currency={currency}
        locales={locales}
        defaultLocale={defaultLocale}
      />

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "category" ? t("deleteCategory") : t("deleteItem")}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "category"
                ? t("deleteCategoryConfirm", {
                    name: confirm.category.name,
                    count: confirm.category.items.length,
                  })
                : confirm?.kind === "item"
                  ? t("deleteItemConfirm", { name: confirm.item.name })
                  : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{tc("cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
