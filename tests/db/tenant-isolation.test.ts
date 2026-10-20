/**
 * Tenant isolation, enforced by Postgres RLS + column grants (not by application code).
 * Runs against the local Postgres: `npm run db:start && npm run db:migrate && npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb, withRls } from "@/lib/db/client";
import {
  auditLogs,
  categories,
  invoices,
  items,
  merchantMembers,
  merchants,
  orderItems,
  orders,
  plans,
  profiles,
  pushSubscriptions,
  subscriptions,
} from "@/lib/db/schema";
import {
  createAuthUser,
  createTenant,
  deleteAuthUsers,
  ensureTestPlan,
  makeAdmin,
  type Tenant,
} from "./fixtures";

let a: Tenant;
let b: Tenant;
let staffA: string;
let adminId: string;
let outsider: string;
const createdUsers: string[] = [];

/** Postgres error code, unwrapping drizzle's query error. */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
}

beforeAll(async () => {
  const planId = await ensureTestPlan();
  a = await createTenant("alpha", planId);
  b = await createTenant("beta", planId);
  staffA = await createAuthUser("alpha-staff");
  await serviceDb
    .insert(merchantMembers)
    .values({ merchantId: a.merchantId, userId: staffA, role: "staff" });
  adminId = await createAuthUser("admin");
  await makeAdmin(adminId);
  outsider = await createAuthUser("outsider");
  createdUsers.push(a.ownerId, b.ownerId, staffA, adminId, outsider);
});

afterAll(async () => {
  await serviceDb.delete(merchants).where(eq(merchants.id, a.merchantId));
  await serviceDb.delete(merchants).where(eq(merchants.id, b.merchantId));
  await deleteAuthUsers(createdUsers);
  await closeDb();
});

describe("owner of merchant A", () => {
  it("sees only its own merchant, menu, orders and billing", async () => {
    await withRls(a.ownerId, async (tx) => {
      const ms = await tx.select({ id: merchants.id }).from(merchants);
      expect(ms.map((m) => m.id)).toEqual([a.merchantId]);
      const cats = await tx.select({ m: categories.merchantId }).from(categories);
      expect(new Set(cats.map((c) => c.m))).toEqual(new Set([a.merchantId]));
      const os = await tx.select({ id: orders.id }).from(orders);
      expect(os.map((o) => o.id)).toEqual([a.orderId]);
      const inv = await tx.select({ id: invoices.id }).from(invoices);
      expect(inv.map((i) => i.id)).toEqual([a.invoiceId]);
    });
  });

  it("cannot update or delete merchant B's rows (silently filtered)", async () => {
    await withRls(a.ownerId, async (tx) => {
      const updated = await tx
        .update(items)
        .set({ priceMinor: 1 })
        .where(eq(items.id, b.itemId))
        .returning({ id: items.id });
      expect(updated).toHaveLength(0);
      const deleted = await tx
        .delete(categories)
        .where(eq(categories.id, b.categoryId))
        .returning({ id: categories.id });
      expect(deleted).toHaveLength(0);
      const orderUpdate = await tx
        .update(orders)
        .set({ status: "canceled" })
        .where(eq(orders.id, b.orderId))
        .returning({ id: orders.id });
      expect(orderUpdate).toHaveLength(0);
    });
    const [item] = await serviceDb.select().from(items).where(eq(items.id, b.itemId));
    expect(item?.priceMinor).toBe(15000);
  });

  it("cannot insert rows into merchant B", async () => {
    await expect(
      withRls(a.ownerId, (tx) =>
        tx.insert(categories).values({ merchantId: b.merchantId, name: "Hack" }),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });

  it("cannot change its own account status, plan or slug", async () => {
    for (const patch of [
      { status: "active" as const },
      { planId: randomUUID() },
      { slug: "stolen-slug" },
      { periodEnd: new Date("2099-01-01") },
    ]) {
      await expect(
        withRls(a.ownerId, (tx) =>
          tx.update(merchants).set(patch).where(eq(merchants.id, a.merchantId)),
        ),
      ).rejects.toSatisfy((e) => pgCode(e) === "42501");
    }
  });

  it("can edit its own shop fields and menu", async () => {
    await withRls(a.ownerId, async (tx) => {
      const r = await tx
        .update(merchants)
        .set({ isOpen: false })
        .where(eq(merchants.id, a.merchantId))
        .returning({ id: merchants.id });
      expect(r).toHaveLength(1);
      const c = await tx
        .insert(categories)
        .values({ merchantId: a.merchantId, name: "Sandwiches" })
        .returning({ id: categories.id });
      expect(c).toHaveLength(1);
    });
  });

  it("cannot write billing tables or audit logs", async () => {
    await expect(
      withRls(a.ownerId, (tx) =>
        tx.update(invoices).set({ status: "paid" }).where(eq(invoices.id, a.invoiceId)),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
    await expect(
      withRls(a.ownerId, (tx) =>
        tx.insert(auditLogs).values({ merchantId: a.merchantId, actorType: "user", action: "x" }),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
    await expect(
      withRls(a.ownerId, (tx) =>
        tx
          .update(subscriptions)
          .set({ isTrial: true })
          .where(eq(subscriptions.merchantId, a.merchantId)),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });

  it("cannot promote itself to platform admin", async () => {
    await expect(
      withRls(a.ownerId, (tx) =>
        tx.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, a.ownerId)),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });

  it("never reads push endpoints or keys", async () => {
    await expect(
      withRls(a.ownerId, (tx) =>
        tx.select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
    const rows = await withRls(a.ownerId, (tx) =>
      tx.select({ status: pushSubscriptions.status }).from(pushSubscriptions),
    );
    expect(rows).toHaveLength(1);
  });

  it("cannot rewrite order totals or customer data", async () => {
    await expect(
      withRls(a.ownerId, (tx) =>
        tx.update(orders).set({ totalMinor: 0 }).where(eq(orders.id, a.orderId)),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });
});

describe("staff of merchant A", () => {
  it("reads and moves A's orders", async () => {
    await withRls(staffA, async (tx) => {
      const os = await tx.select({ id: orders.id }).from(orders);
      expect(os.map((o) => o.id)).toEqual([a.orderId]);
      const r = await tx
        .update(orders)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(orders.id, a.orderId))
        .returning({ id: orders.id });
      expect(r).toHaveLength(1);
      const lines = await tx.select().from(orderItems);
      expect(lines.every((l) => l.merchantId === a.merchantId)).toBe(true);
    });
  });

  it("cannot see billing or edit the menu or shop", async () => {
    await withRls(staffA, async (tx) => {
      expect(await tx.select().from(invoices)).toHaveLength(0);
      expect(await tx.select().from(subscriptions)).toHaveLength(0);
      expect(await tx.select().from(auditLogs)).toHaveLength(0);
      const upd = await tx
        .update(merchants)
        .set({ isOpen: true })
        .where(eq(merchants.id, a.merchantId))
        .returning({ id: merchants.id });
      expect(upd).toHaveLength(0);
    });
    await expect(
      withRls(staffA, (tx) =>
        tx.insert(categories).values({ merchantId: a.merchantId, name: "Nope" }),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });

  it("sees only its own membership plus nothing of merchant B", async () => {
    await withRls(staffA, async (tx) => {
      const mem = await tx.select().from(merchantMembers);
      expect(mem.map((m) => m.userId)).toEqual([staffA]);
      const os = await tx.select().from(orders).where(eq(orders.merchantId, b.merchantId));
      expect(os).toHaveLength(0);
    });
  });
});

describe("users without a membership", () => {
  it("see nothing", async () => {
    await withRls(outsider, async (tx) => {
      expect(await tx.select().from(merchants)).toHaveLength(0);
      expect(await tx.select().from(orders)).toHaveLength(0);
      expect(await tx.select().from(categories)).toHaveLength(0);
      const me = await tx.select().from(profiles);
      expect(me.map((p) => p.id)).toEqual([outsider]);
    });
  });

  it("anon has no table privileges at all", async () => {
    await expect(
      serviceDb.transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        await tx.select().from(merchants);
      }),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
    await expect(
      serviceDb.transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        await tx.select().from(plans);
      }),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });
});

describe("platform admin", () => {
  it("reads every tenant but still cannot write billing directly", async () => {
    await withRls(adminId, async (tx) => {
      const ms = await tx.select({ id: merchants.id }).from(merchants);
      const ids = ms.map((m) => m.id);
      expect(ids).toContain(a.merchantId);
      expect(ids).toContain(b.merchantId);
    });
    await expect(
      withRls(adminId, (tx) =>
        tx.update(invoices).set({ status: "paid" }).where(eq(invoices.id, b.invoiceId)),
      ),
    ).rejects.toSatisfy((e) => pgCode(e) === "42501");
  });
});
