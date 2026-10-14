/**
 * Shop URL slugs: /s/<slug>. Lowercase ASCII letters, digits and single dashes, 3–40 chars,
 * no leading/trailing dash. Mirrors the `merchants_slug_format` check constraint.
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Words that would collide with app routes, or impersonate the platform. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "demo",
  "help",
  "legal",
  "login",
  "logout",
  "o",
  "order",
  "orders",
  "pricing",
  "privacy",
  "ranna",
  "s",
  "settings",
  "shop",
  "signup",
  "start",
  "static",
  "support",
  "terms",
  "www",
  "ar",
  "fr",
  "en",
]);

export type SlugProblem =
  "too_short" | "too_long" | "invalid_chars" | "edge_dash" | "double_dash" | "reserved";

export function validateSlug(slug: string): { ok: true } | { ok: false; problem: SlugProblem } {
  if (slug.length < SLUG_MIN) return { ok: false, problem: "too_short" };
  if (slug.length > SLUG_MAX) return { ok: false, problem: "too_long" };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, problem: "invalid_chars" };
  if (slug.startsWith("-") || slug.endsWith("-")) return { ok: false, problem: "edge_dash" };
  if (slug.includes("--")) return { ok: false, problem: "double_dash" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, problem: "reserved" };
  return { ok: true };
}

/** Normalises free text a merchant types into the slug field ("Café Él Bahdja" -> "cafe-el-bahdja"). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/**
 * A starting suggestion from the shop name. Arabic-only names have no Latin letters, so they
 * fall back to a neutral "shop-xxxx" the merchant is invited to edit.
 */
export function suggestSlug(name: string, randomSuffix: string): string {
  const base = slugify(name);
  if (base.length >= SLUG_MIN && !RESERVED_SLUGS.has(base)) return base;
  return `shop-${
    randomSuffix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 6) || "1"
  }`;
}
