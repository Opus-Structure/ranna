/** Table QR codes: validation, uniqueness per shop, series, and tenant isolation. */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants, qrCodes } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { addTableQr, addTableRange, deleteTableQr, listTableQrs } from "@/lib/qr/service";
import { createAuthUser, deleteAuthUsers } from "./fixtures";

const users: string[] = [];
const merchantIds: string[] = [];

async function owner(label: string): Promise<MerchantContext> {
  const userId = await createAuthUser(label);
  users.push(userId);
  const [m] = await serviceDb
    .insert(merchants)
    .values({
      name: `${label} shop`,
      slug: `${label}-${randomUUID().slice(0, 6)}`,
      status: "active",
    })
    .returning();
  merchantIds.push(m!.id);
  await serviceDb.insert(merchantMembers).values({ merchantId: m!.id, userId, role: "owner" });
  return {
    user: { id: userId, email: null, emailVerified: true },
    role: "owner",
    merchant: {
      id: m!.id,
      name: m!.name,
      slug: m!.slug,
      status: "active",
      periodEnd: null,
      graceUntil: null,
      isOpen: true,
      acceptingOrders: true,
      currency: "DZD",
      timezone: "Africa/Algiers",
      defaultLocale: "ar",
      setupCompletedAt: null,
    },
  };
}

afterAll(async () => {
  for (const id of merchantIds) await serviceDb.delete(merchants).where(eq(merchants.id, id));
  await deleteAuthUsers(users);
  await closeDb();
});

describe("table QR codes", () => {
  it("adds, refuses duplicate codes, and validates input", async () => {
    const ctx = await owner("qr");
    expect(await addTableQr(ctx, { label: "Terrasse 1", tableCode: "T1" })).toEqual({ ok: true });
    expect(await addTableQr(ctx, { label: "Other", tableCode: "T1" })).toMatchObject({
      ok: false,
      error: "code_taken",
    });
    expect(await addTableQr(ctx, { label: "Bad", tableCode: "a b" })).toMatchObject({
      ok: false,
      error: "code",
    });
    expect(await addTableQr(ctx, { label: "  ", tableCode: "T2" })).toMatchObject({
      ok: false,
      error: "labelRequired",
    });
  });

  it("adds a numbered series and skips codes that already exist", async () => {
    const ctx = await owner("series");
    await addTableQr(ctx, { label: "Table 2", tableCode: "2" });
    expect(await addTableRange(ctx, { prefix: "Table", from: 1, to: 4 })).toEqual({ ok: true });
    const rows = await listTableQrs(ctx);
    expect(rows.map((r) => r.tableCode).sort()).toEqual(["1", "2", "3", "4"]);
    expect(await addTableRange(ctx, { prefix: "Table", from: 5, to: 300 })).toMatchObject({
      ok: false,
      error: "range",
    });
  });

  it("never lists or deletes another shop's codes", async () => {
    const a = await owner("qr-a");
    const b = await owner("qr-b");
    await addTableQr(a, { label: "A1", tableCode: "1" });
    expect(await listTableQrs(b)).toEqual([]);
    const [row] = await serviceDb
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.merchantId, a.merchant.id));
    expect(await deleteTableQr(b, row!.id)).toMatchObject({ ok: false, error: "not_found" });
    expect(await deleteTableQr(a, row!.id)).toEqual({ ok: true });
  });
});
