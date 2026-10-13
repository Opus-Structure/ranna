import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

type SqlClient = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { __rannaSql?: SqlClient; __rannaDb?: Db };

function getDb(): Db {
  if (globalForDb.__rannaDb) return globalForDb.__rannaDb;
  const client =
    globalForDb.__rannaSql ??
    postgres(serverEnv().DATABASE_URL, {
      // Supabase's transaction pooler does not support prepared statements.
      prepare: false,
      max: process.env.NODE_ENV === "production" ? 3 : 5,
      idle_timeout: 20,
      connection: { application_name: "ranna" },
    });
  const db = drizzle(client, { schema });
  // Reuse one pool across hot reloads in dev and across invocations of a warm lambda.
  globalForDb.__rannaSql = client;
  globalForDb.__rannaDb = db;
  return db;
}

/**
 * Privileged connection: bypasses RLS. Only for system code (webhooks, cron, order placement,
 * token lookups, admin services after an explicit admin check). Always filter by tenant.
 * Created lazily so builds and unit tests never need DATABASE_URL.
 */
export const serviceDb: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const db = getDb();
    const value: unknown = Reflect.get(db, prop);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

/**
 * Runs `fn` as the given Supabase user with Postgres RLS enforced: the transaction switches to
 * the `authenticated` role and exposes the user id to `auth.uid()` through request.jwt.claims.
 */
export async function withRls<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return serviceDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/** Closes the pool (scripts and tests only). */
export async function closeDb(): Promise<void> {
  await globalForDb.__rannaSql?.end({ timeout: 5 });
  globalForDb.__rannaSql = undefined;
  globalForDb.__rannaDb = undefined;
}
