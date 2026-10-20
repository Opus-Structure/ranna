/**
 * `npm run setup:env`: writes `.env.local` for development in one step. It generates the app
 * secret, cron secret, VAPID key pair and seed passwords. Neon Auth, Realtime and Object Storage have
 * no local stand-in, so their values (and that branch's DATABASE_URL, since auth users live in the
 * app's database) come from a Neon dev branch: pass `--from <file>` (KEY=value lines, e.g. the output
 * of `neon env pull`) to merge them in, or fill them into `.env.local` by hand.
 * It never overwrites an existing `.env.local` (pass --force to). Secrets are written to the file
 * only, never printed.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const target = process.env.ENV_TARGET ?? ".env.local";
if (existsSync(target) && !process.argv.includes("--force")) {
  console.error(`${target} already exists; nothing changed (use --force to regenerate it).`);
  process.exit(1);
}

function readPairs(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1]!, m[2]!.replace(/^"(.*)"$/, "$1")]),
  );
}

const fromIndex = process.argv.indexOf("--from");
const fromFile = fromIndex > -1 ? process.argv[fromIndex + 1] : undefined;
if (fromIndex > -1 && (!fromFile || !existsSync(fromFile))) {
  console.error("--from needs the path of an existing KEY=value file.");
  process.exit(1);
}
const neon = fromFile ? readPairs(fromFile) : {};

const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
const vapid = webpush.generateVAPIDKeys();
const s3Endpoint = neon.S3_ENDPOINT ?? "";
const values: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  // Auth users live in the app's database, so a dev server that uses a Neon branch's Auth uses
  // that branch's database too. DB tests always run on the local Postgres (see tests/db/setup-env.ts).
  DATABASE_URL: neon.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  APP_SECRET: secret(),
  NEON_AUTH_COOKIE_SECRET: secret(),
  VAPID_PRIVATE_KEY: vapid.privateKey,
  CRON_SECRET: secret(),
  SEED_ADMIN_PASSWORD: secret(12),
  SEED_DEMO_PASSWORD: secret(12),
  ...(s3Endpoint
    ? { NEXT_PUBLIC_ASSETS_URL: `${s3Endpoint.replace(/\/$/, "")}/merchant-assets` }
    : {}),
  ...(neon.NEON_REALTIME_URL ? { NEXT_PUBLIC_REALTIME_URL: neon.NEON_REALTIME_URL } : {}),
  ...Object.fromEntries(
    [
      "NEON_AUTH_BASE_URL",
      "NEON_REALTIME_URL",
      "NEON_REALTIME_SECRET",
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ]
      .filter((k) => neon[k])
      .map((k) => [k, neon[k]!]),
  ),
};

// Start from the template so comments and defaults stay in one place.
const template = readFileSync(".env.example", "utf8");
const filled = template
  .split(/\r?\n/)
  .map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    return m && values[m[1]!] !== undefined ? `${m[1]}=${values[m[1]!]}` : line;
  })
  .join("\n");
writeFileSync(target, filled, { mode: 0o600 });
console.info(
  `${target} written. Next: npm run db:start && npm run db:migrate && npm run seed && npm run dev`,
);
if (!fromFile) {
  console.info(
    "Auth, Realtime and Storage values are empty: fill NEON_* and S3_* from your Neon branch.",
  );
}
console.info("Seeded sign-ins: SEED_ADMIN_* and SEED_DEMO_* in .env.local.");
