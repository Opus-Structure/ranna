"use server";

import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";
import { clientIp, hashIdentifier } from "@/lib/http/request";
import { placeOrder, type PlaceOrderResult } from "@/lib/orders/service";
import { checkLimit, postgresRateLimiter } from "@/lib/rate-limit";

export type PlaceOrderActionResult =
  PlaceOrderResult | { ok: false; error: "rate_limited"; itemId?: undefined };

/**
 * Anonymous order placement. Next's Server Action origin check guards against cross-site
 * posts; a per-device-IP limit plus a tighter per-shop limit guard against floods. A CAPTCHA
 * can be added here (the honeypot field is checked inside `placeOrder`).
 */
export async function placeOrderAction(input: unknown): Promise<PlaceOrderActionResult> {
  const ip = hashIdentifier(clientIp(await headers()), serverEnv().APP_SECRET);
  const slug =
    typeof input === "object" && input !== null && "slug" in input
      ? String((input as { slug: unknown }).slug)
      : "";
  const [perIp, perShop] = await Promise.all([
    checkLimit("placeOrder", ip),
    postgresRateLimiter.consume(`placeOrderShop:${ip}:${slug.slice(0, 40)}`, 5, 5 * 60),
  ]);
  if (!perIp.ok || !perShop.ok) return { ok: false, error: "rate_limited" };
  try {
    return await placeOrder(input);
  } catch (err) {
    console.error("place order failed", { error: err instanceof Error ? err.message : err });
    return { ok: false, error: "invalid" };
  }
}
