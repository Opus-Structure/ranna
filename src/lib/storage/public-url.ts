/**
 * Public URL of an object in the `merchant-assets` bucket. Pure string building, so it works in
 * server components, the editor's live preview, and emails alike.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/merchant-assets/${encoded}`;
}
