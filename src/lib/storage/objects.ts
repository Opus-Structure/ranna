import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type Bucket = "merchant-assets" | "receipts";

/** Uploads with the service role. Callers must have authorised the merchant first. */
export async function putObject(
  bucket: Bucket,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function removeObject(bucket: Bucket, path: string) {
  await getSupabaseAdmin().storage.from(bucket).remove([path]);
}

/** Short-lived link to a private object (receipts are only shown to platform admins). */
export async function signedUrl(
  bucket: Bucket,
  path: string,
  seconds = 300,
): Promise<string | null> {
  const { data } = await getSupabaseAdmin().storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Public URL for objects in the public bucket (logos, covers, item photos). */
export function publicUrl(path: string): string {
  return getSupabaseAdmin().storage.from("merchant-assets").getPublicUrl(path).data.publicUrl;
}
