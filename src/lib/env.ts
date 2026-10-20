import { z } from "zod";

/**
 * Server environment, validated once on first use (not at import time, so `next build`
 * and unit tests do not need every secret). Never import this from client components.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  /** Managed Better Auth (Neon). The app proxies it under /api/auth. */
  NEON_AUTH_BASE_URL: z.string().url(),
  NEON_AUTH_COOKIE_SECRET: z
    .string()
    .min(32, "NEON_AUTH_COOKIE_SECRET must be at least 32 characters"),
  /** Neon Realtime. Empty = no live push; pages fall back to polling. */
  NEON_REALTIME_URL: z.string().optional().default(""),
  NEON_REALTIME_SECRET: z.string().optional().default(""),
  /** Neon Object Storage (S3 API). Needed for uploads; public reads go through the bucket URL. */
  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default("mailto:support@example.com"),
  PAYMENT_PROVIDERS: z.string().default("mock,manual"),
  CHARGILY_MODE: z.enum(["test", "live"]).default("test"),
  CHARGILY_SECRET_KEY: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  MAILER: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().optional().default(""),
  MAIL_FROM: z.string().default("Ranna <no-reply@example.com>"),
  SMS_PROVIDER: z.enum(["mock"]).default("mock"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment. See .env.example.\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
