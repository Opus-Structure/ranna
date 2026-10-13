import { z } from "zod";

/**
 * Server environment, validated once on first use (not at import time, so `next build`
 * and unit tests do not need every secret). Never import this from client components.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
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
