import "server-only";
import { revalidateTag } from "next/cache";

/** Cache tags for the public shop page data (menu, branding, status). */
export const shopTag = (merchantId: string) => `shop:${merchantId}`;
export const slugTag = (slug: string) => `shop-slug:${slug}`;

/**
 * Drops cached public data after a change. Safe to call from scripts and tests, where there
 * is no Next.js cache to revalidate.
 */
export function invalidateShop(merchantId: string, ...slugs: (string | null | undefined)[]): void {
  try {
    revalidateTag(shopTag(merchantId));
    for (const slug of slugs) if (slug) revalidateTag(slugTag(slug));
  } catch {
    // Outside a Next.js request (seed, tests): nothing is cached.
  }
}
