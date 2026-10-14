/** Regression: parallel first visits must not create two shops for one owner. */
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants } from "@/lib/db/schema";
import { createMerchantForOwner } from "@/lib/merchants/service";
import { createAuthUser, deleteAuthUsers } from "./fixtures";

const users: string[] = [];

afterAll(async () => {
  for (const userId of users) {
    const rows = await serviceDb
      .select({ id: merchantMembers.merchantId })
      .from(merchantMembers)
      .where(eq(merchantMembers.userId, userId));
    for (const r of rows) await serviceDb.delete(merchants).where(eq(merchants.id, r.id));
  }
  await deleteAuthUsers(users);
  await closeDb();
});

describe("createMerchantForOwner", () => {
  it("creates exactly one shop when called concurrently", async () => {
    const userId = await createAuthUser("race");
    users.push(userId);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createMerchantForOwner({ userId, name: "Race café", locale: "ar" }),
      ),
    );
    expect(new Set(results.map((r) => r.merchantId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const memberships = await serviceDb
      .select()
      .from(merchantMembers)
      .where(eq(merchantMembers.userId, userId));
    expect(memberships).toHaveLength(1);
  });
});
