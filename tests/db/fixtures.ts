import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { serviceDb } from "@/lib/db/client";
import {
  categories,
  invoices,
  items,
  merchantMembers,
  merchants,
  orders,
  plans,
  profiles,
  pushSubscriptions,
} from "@/lib/db/schema";

/** Creates an auth user directly (the on_auth_user_created trigger adds the profile). */
export async function createAuthUser(label: string): Promise<string> {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@test.ranna.local`;
  await serviceDb.execute(sql`
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            ${email}, '{"locale":"fr"}'::jsonb, now(), now())`);
  return id;
}

export async function deleteAuthUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await serviceDb.execute(sql`delete from auth.users where id in ${ids}`);
}

export async function ensureTestPlan(): Promise<string> {
  const code = "test-plan";
  const [existing] = await serviceDb
    .select({ id: plans.id })
    .from(plans)
    .where(inArray(plans.code, [code]));
  if (existing) return existing.id;
  const [row] = await serviceDb
    .insert(plans)
    .values({
      code,
      name: "Test",
      priceMinor: 100000,
      limits: { maxItems: 10, maxStaff: 2, maxMonthlyOrders: null },
      isActive: false,
    })
    .returning({ id: plans.id });
  return row!.id;
}

export type Tenant = {
  merchantId: string;
  ownerId: string;
  categoryId: string;
  itemId: string;
  orderId: string;
  invoiceId: string;
};

/** A merchant with an owner, one category, one item, one order, one invoice and a push sub. */
export async function createTenant(label: string, planId: string): Promise<Tenant> {
  const ownerId = await createAuthUser(`${label}-owner`);
  const [m] = await serviceDb
    .insert(merchants)
    .values({
      name: `${label} café`,
      slug: `${label}-${ownerId.slice(0, 6)}`,
      status: "active",
      planId,
    })
    .returning({ id: merchants.id });
  const merchantId = m!.id;
  await serviceDb.insert(merchantMembers).values({ merchantId, userId: ownerId, role: "owner" });
  const [c] = await serviceDb
    .insert(categories)
    .values({ merchantId, name: "Drinks" })
    .returning({ id: categories.id });
  const [i] = await serviceDb
    .insert(items)
    .values({ merchantId, categoryId: c!.id, name: "Coffee", priceMinor: 15000 })
    .returning({ id: items.id });
  const [o] = await serviceDb
    .insert(orders)
    .values({
      merchantId,
      number: 101,
      businessDate: "2026-10-13",
      tokenHash: randomUUID(),
      clientRequestId: randomUUID(),
      customerName: "Amine",
      customerPhone: "0555000000",
      subtotalMinor: 15000,
      totalMinor: 15000,
      currency: "DZD",
    })
    .returning({ id: orders.id });
  const [inv] = await serviceDb
    .insert(invoices)
    .values({
      merchantId,
      number: `T-${randomUUID().slice(0, 12)}`,
      planId,
      amountMinor: 100000,
      currency: "DZD",
    })
    .returning({ id: invoices.id });
  await serviceDb.insert(pushSubscriptions).values({
    orderId: o!.id,
    merchantId,
    endpoint: `https://push.example.test/${randomUUID()}`,
    p256dh: "p256dh-secret",
    auth: "auth-secret",
  });
  return {
    merchantId,
    ownerId,
    categoryId: c!.id,
    itemId: i!.id,
    orderId: o!.id,
    invoiceId: inv!.id,
  };
}

export async function makeAdmin(userId: string): Promise<void> {
  await serviceDb.execute(
    sql`update public.profiles set is_platform_admin = true where id = ${userId}`,
  );
}

export { profiles };
