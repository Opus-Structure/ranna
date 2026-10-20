/**
 * Applies db/migrations/*.sql in order, once each, against DATABASE_URL (.env.local).
 * Each file runs in its own transaction and is recorded in `migrations.applied`, so reruns are
 * no-ops. Usage: `npm run db:migrate`  (or `DATABASE_URL=… npm run db:migrate` for another DB).
 */
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = join(process.cwd(), "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });

try {
  await sql`create schema if not exists migrations`;
  await sql`create table if not exists migrations.applied (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const done = new Set(
    (await sql<{ name: string }[]>`select name from migrations.applied`).map((r) => r.name),
  );
  let ran = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", "");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into migrations.applied (name) values (${file})`;
    });
    console.info(`applied ${file}`);
    ran++;
  }
  console.info(ran ? `${ran} migration(s) applied.` : "Database is up to date.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
