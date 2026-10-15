/**
 * Schema-driven guard: every table in `public` has row level security, and for every table that
 * carries a `merchant_id`, a member of one shop reads none of another shop's rows. New tables
 * are covered automatically, so a table added without policies fails here.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb, withRls } from "@/lib/db/client";
import { merchants } from "@/lib/db/schema";
import { createTenant, deleteAuthUsers, ensureTestPlan, type Tenant } from "./fixtures";

let a: Tenant;
let b: Tenant;

/** "permission denied" (no grant at all) aborts the transaction; for these checks it means no leak. */
function noGrantIsZero(err: unknown): number {
  const e = err as { code?: string; cause?: { code?: string } };
  if (e.code === "42501" || e.cause?.code === "42501" || String(err).includes("permission denied"))
    return 0;
  throw err;
}

beforeAll(async () => {
  const planId = await ensureTestPlan();
  a = await createTenant("rls-cov-a", planId);
  b = await createTenant("rls-cov-b", planId);
});

afterAll(async () => {
  for (const t of [a, b]) await serviceDb.delete(merchants).where(eq(merchants.id, t.merchantId));
  await deleteAuthUsers([a.ownerId, b.ownerId]);
  await closeDb();
});

describe("row level security coverage", () => {
  it("is enabled on every table in the public schema", async () => {
    const rows = await serviceDb.execute<{ table: string; rls: boolean }>(sql`
      select c.relname as "table", c.relrowsecurity as rls
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => !r.rls).map((r) => r.table)).toEqual([]);
  });

  it("never shows a member another shop's rows, in any table that has a merchant_id", async () => {
    const tables = await serviceDb.execute<{ table: string }>(sql`
      select c.table_name as "table" from information_schema.columns c
        join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'merchant_id' and t.table_type = 'BASE TABLE'`);
    expect(tables.length).toBeGreaterThan(8);
    const leaks: string[] = [];
    for (const { table } of tables) {
      // B really has rows in several of these tables, so zero is a real answer.
      const seen = await withRls(a.ownerId, async (tx) => {
        const r = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from ${sql.identifier(table)} where merchant_id = ${b.merchantId}`,
        );
        return r[0]?.n ?? 0;
      }).catch(noGrantIsZero);
      if (seen > 0) leaks.push(`${table}: ${seen}`);
    }
    expect(leaks).toEqual([]);
  });

  it("gives anonymous visitors no rows from any table", async () => {
    const tables = await serviceDb.execute<{ table: string }>(sql`
      select table_name as "table" from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`);
    const readable: string[] = [];
    for (const { table } of tables) {
      const n = await serviceDb
        .transaction(async (tx) => {
          await tx.execute(sql`set local role anon`);
          const r = await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from ${sql.identifier(table)}`,
          );
          return r[0]?.n ?? 0;
        })
        .catch(noGrantIsZero);
      if (n > 0) readable.push(table);
    }
    expect(readable).toEqual([]);
  });
});
