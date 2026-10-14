"use server";

import { revalidatePath } from "next/cache";
import { memberAction, ownerAction } from "@/lib/auth/action-context";
import {
  changeSlug,
  completeSetup,
  setShopToggles,
  updateBranding,
  updateOpeningHours,
  updateOrderingSettings,
  updateRegional,
  updateShopProfile,
  type ShopResult,
} from "@/lib/shop/service";
import { storeMerchantImage, type ImageKind, type ImageUploadResult } from "@/lib/shop/images";

const forbidden = { ok: false as const, error: "forbidden" };

function refresh() {
  revalidatePath("/[locale]/dashboard", "layout");
}

async function withOwner<T>(
  run: (ctx: NonNullable<Awaited<ReturnType<typeof ownerAction>>>) => Promise<ShopResult<T>>,
) {
  const ctx = await ownerAction();
  if (!ctx) return forbidden;
  const result = await run(ctx);
  if (result.ok) refresh();
  return result;
}

export async function saveProfileAction(input: unknown) {
  return withOwner((ctx) => updateShopProfile(ctx, input));
}

export async function saveSlugAction(slug: string) {
  return withOwner((ctx) => changeSlug(ctx, slug));
}

export async function saveBrandingAction(
  input: unknown,
  images: { logoPath?: string | null; coverPath?: string | null },
) {
  return withOwner((ctx) => updateBranding(ctx, input, images));
}

export async function saveHoursAction(hours: unknown) {
  return withOwner((ctx) => updateOpeningHours(ctx, hours));
}

export async function saveOrderingSettingsAction(input: unknown) {
  return withOwner((ctx) => updateOrderingSettings(ctx, input));
}

export async function saveRegionalAction(input: unknown) {
  return withOwner((ctx) => updateRegional(ctx, input));
}

export async function completeSetupAction() {
  return withOwner((ctx) => completeSetup(ctx));
}

/** Open/closed is owner-only; "taking orders" may be paused by staff during a rush. */
export async function setTogglesAction(toggles: { isOpen?: boolean; acceptingOrders?: boolean }) {
  const ctx = await memberAction();
  if (!ctx) return forbidden;
  const result = await setShopToggles(ctx, toggles);
  if (result.ok) refresh();
  return result;
}

export async function uploadImageAction(form: FormData): Promise<ImageUploadResult> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  const kind = form.get("kind");
  if (kind !== "logo" && kind !== "cover" && kind !== "item")
    return { ok: false, error: "bad_type" };
  return storeMerchantImage(ctx, kind as ImageKind, form.get("file"));
}
