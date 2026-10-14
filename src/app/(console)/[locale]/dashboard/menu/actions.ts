"use server";

import { revalidatePath } from "next/cache";
import { ownerAction } from "@/lib/auth/action-context";
import {
  createCategory,
  deleteCategory,
  deleteItem,
  reorderCategories,
  reorderItems,
  saveItem,
  setItemAvailability,
  setItemImage,
  updateCategory,
  type MenuResult,
} from "@/lib/menu/service";
import type { MerchantContext } from "@/lib/merchants/context";

async function run<T>(
  fn: (ctx: MerchantContext) => Promise<MenuResult<T>>,
): Promise<MenuResult<T>> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/[locale]/dashboard/menu", "page");
  return result;
}

export const createCategoryAction = async (input: unknown) =>
  run((ctx) => createCategory(ctx, input));
export const updateCategoryAction = async (id: string, input: unknown) =>
  run((ctx) => updateCategory(ctx, id, input));
export const deleteCategoryAction = async (id: string) => run((ctx) => deleteCategory(ctx, id));
export const reorderCategoriesAction = async (ids: string[]) =>
  run((ctx) => reorderCategories(ctx, ids));
export const reorderItemsAction = async (categoryId: string, ids: string[]) =>
  run((ctx) => reorderItems(ctx, categoryId, ids));
export const saveItemAction = async (input: unknown) => run((ctx) => saveItem(ctx, input));
export const setItemAvailabilityAction = async (id: string, available: boolean) =>
  run((ctx) => setItemAvailability(ctx, id, available));
export const setItemImageAction = async (id: string, path: string | null) =>
  run((ctx) => setItemImage(ctx, id, path));
export const deleteItemAction = async (id: string) => run((ctx) => deleteItem(ctx, id));
