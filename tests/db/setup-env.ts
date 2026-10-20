import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// DB tests create and delete real rows: they only ever run on the local Postgres (`npm run
// db:start && npm run db:migrate`), whatever DATABASE_URL points at. Override with TEST_DATABASE_URL.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
