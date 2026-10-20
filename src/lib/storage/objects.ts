import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/env";
import { assetUrl } from "./public-url";

export type Bucket = "merchant-assets" | "receipts";

let client: S3Client | undefined;

/** Neon Object Storage speaks the S3 API: path-style addressing, branch-scoped endpoint. */
function s3(): S3Client {
  if (client) return client;
  const env = serverEnv();
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "Object storage is not configured (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).",
    );
  }
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    // Checksums computed from an empty body at presign time would reject real uploads.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return client;
}

/** Uploads with the app's storage credential. Callers must have authorised the merchant first. */
export async function putObject(
  bucket: Bucket,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (err) {
    throw new Error(`storage upload failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function removeObject(bucket: Bucket, path: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
}

/** Short-lived link to a private object (receipts are only shown to platform admins). */
export async function signedUrl(
  bucket: Bucket,
  path: string,
  seconds = 300,
): Promise<string | null> {
  try {
    return await getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket, Key: path }), {
      expiresIn: seconds,
    });
  } catch {
    return null;
  }
}

/** Public URL for objects in the public bucket (logos, covers, item photos). */
export function publicUrl(path: string): string {
  return assetUrl(path) ?? "";
}
