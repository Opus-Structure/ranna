/**
 * Detects a file's real type from its first bytes. Uploads are accepted by content, never by
 * the client-supplied name or MIME type.
 */
export type SniffedType = {
  mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  ext: string;
};

export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (
    b.length >= 5 &&
    b[0] === 0x25 &&
    b[1] === 0x50 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x2d
  ) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  return null;
}

export const MB = 1024 * 1024;

export type UploadCheck =
  | { ok: true; bytes: Uint8Array; type: SniffedType }
  | { ok: false; error: "missing" | "too_large" | "bad_type" };

/** Size + content-type gate for an uploaded File. */
export async function checkUpload(
  file: unknown,
  { maxBytes, allow }: { maxBytes: number; allow: SniffedType["mime"][] },
): Promise<UploadCheck> {
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "missing" };
  if (file.size > maxBytes) return { ok: false, error: "too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(bytes);
  if (!type || !allow.includes(type.mime)) return { ok: false, error: "bad_type" };
  return { ok: true, bytes, type };
}
