/**
 * Public URL of an object in the `merchant-assets` bucket (a public_read bucket on Neon Object
 * Storage). NEXT_PUBLIC_ASSETS_URL is the bucket's base URL, e.g.
 * https://<branch>.storage.<cluster>.neon.tech/merchant-assets. Pure string building, so it
 * works in server components, the editor's live preview, and emails alike.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_ASSETS_URL ?? "").replace(/\/$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}
