"use server";

import { redirect } from "@/i18n/navigation";
import { isAppLocale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { createMerchantForOwner } from "@/lib/merchants/service";
import { shopNameSchema } from "@/lib/validation/auth";

export type StartResult = {
  ok: false;
  error: "shopNameRequired" | "shopNameTooLong" | "forbidden";
};

export async function createShopAction(rawLocale: string, shopName: string): Promise<StartResult> {
  const locale = isAppLocale(rawLocale) ? rawLocale : "ar";
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = shopNameSchema.safeParse(shopName);
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message;
    return { ok: false, error: key === "shopNameTooLong" ? "shopNameTooLong" : "shopNameRequired" };
  }
  await createMerchantForOwner({ userId: user.id, name: parsed.data, locale });
  redirect({ href: "/dashboard", locale });
  return { ok: false, error: "forbidden" };
}
