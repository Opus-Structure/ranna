/**
 * `npm run setup:env`: writes `.env.local` for local development in one step. It reads the local
 * Supabase URL and keys from `supabase status`, and generates the app secret, cron secret, VAPID
 * key pair and seed passwords. It never overwrites an existing `.env.local` (pass --force to).
 * Secrets are written to the file only, never printed.
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const target = process.env.ENV_TARGET ?? ".env.local";
if (existsSync(target) && !process.argv.includes("--force")) {
  console.error(`${target} already exists; nothing changed (use --force to regenerate it).`);
  process.exit(1);
}

let status: string;
try {
  status = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch {
  console.error("Could not read `supabase status`. Start local Supabase first: npm run db:start");
  process.exit(1);
}
const local = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
for (const key of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL"]) {
  if (!local[key]) {
    console.error(`supabase status did not report ${key}; is local Supabase running?`);
    process.exit(1);
  }
}

const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
const vapid = webpush.generateVAPIDKeys();
const values: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY!,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY!,
  DATABASE_URL: local.DB_URL!,
  APP_SECRET: secret(),
  VAPID_PRIVATE_KEY: vapid.privateKey,
  CRON_SECRET: secret(),
  SEED_ADMIN_PASSWORD: secret(12),
  SEED_DEMO_PASSWORD: secret(12),
};

// Start from the template so comments and defaults stay in one place.
const template = readFileSync(".env.example", "utf8");
const filled = template
  .split(/\r?\n/)
  .map((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    return m && values[m[1]!] !== undefined ? `${m[1]}=${values[m[1]!]}` : line;
  })
  .join("\n");
writeFileSync(target, filled, { mode: 0o600 });
console.info(`${target} written. Next: npm run db:reset && npm run seed && npm run dev`);
console.info("Seeded sign-ins: SEED_ADMIN_* and SEED_DEMO_* in .env.local.");
