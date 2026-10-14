import "server-only";
import { randomUUID } from "node:crypto";
import { AccountLockedError, assertCanEdit } from "@/lib/billing/access";
import { checkUpload, MB } from "@/lib/files/sniff";
import type { MerchantContext } from "@/lib/merchants/context";
import { publicUrl, putObject } from "@/lib/storage/objects";

export type ImageKind = "logo" | "cover" | "item";

export type ImageUploadResult =
  | { ok: true; path: string; url: string }
  | { ok: false; error: "forbidden" | "locked" | "missing" | "too_large" | "bad_type" };

/**
 * Stores a merchant image (already resized in the browser) in the public bucket under the
 * merchant's own prefix. Type is checked by content; anything but JPEG/PNG/WebP is refused.
 */
export async function storeMerchantImage(
  ctx: MerchantContext,
  kind: ImageKind,
  file: unknown,
): Promise<ImageUploadResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  try {
    assertCanEdit(ctx);
  } catch (err) {
    if (err instanceof AccountLockedError) return { ok: false, error: "locked" };
    throw err;
  }
  const upload = await checkUpload(file, {
    maxBytes: 2 * MB,
    allow: ["image/jpeg", "image/png", "image/webp"],
  });
  if (!upload.ok) return { ok: false, error: upload.error };
  const path = `${ctx.merchant.id}/${kind}/${randomUUID()}.${upload.type.ext}`;
  await putObject("merchant-assets", path, upload.bytes, upload.type.mime);
  return { ok: true, path, url: publicUrl(path) };
}
