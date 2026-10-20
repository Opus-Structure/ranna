/** Order board, history and staff invitations against the real database (RLS included). */
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants, orders } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import {
  acceptInvitation,
  inviteStaff,
  loadInvitation,
  loadStaff,
  removeMember,
  revokeInvitation,
} from "@/lib/merchants/staff";
import { countNewOrders, loadBoard, loadHistory } from "@/lib/orders/board";
import {
  createAuthUser,
  createTenant,
  deleteAuthUsers,
  ensureTestPlan,
  type Tenant,
} from "./fixtures";

const users: string[] = [];
const merchantIds: string[] = [];
let planId: string;
let a: Tenant;
let b: Tenant;

async function emailOf(userId: string): Promise<string> {
  const rows = await serviceDb.execute<{ email: string }>(
    sql`select email from neon_auth."user" where id = ${userId}`,
  );
  return rows[0]!.email;
}

async function user(label: string) {
  const id = await createAuthUser(label);
  users.push(id);
  return { id, email: await emailOf(id), emailVerified: true };
}

async function ctxFor(
  t: Tenant,
  userId = t.ownerId,
  role: "owner" | "staff" = "owner",
): Promise<MerchantContext> {
  return {
    user: { id: userId, email: await emailOf(userId), emailVerified: true },
    role,
    merchant: {
      id: t.merchantId,
      name: "Test café",
      slug: null,
      status: "active",
      periodEnd: null,
      graceUntil: null,
      isOpen: true,
      acceptingOrders: true,
      currency: "DZD",
      timezone: "Africa/Algiers",
      defaultLocale: "fr",
      setupCompletedAt: null,
    },
  };
}

const tokenOf = (link: string) => link.split("/invite/")[1]!;

beforeAll(async () => {
  planId = await ensureTestPlan(); // maxStaff: 2
  a = await createTenant("board-a", planId);
  b = await createTenant("board-b", planId);
  users.push(a.ownerId, b.ownerId);
  merchantIds.push(a.merchantId, b.merchantId);
});

afterAll(async () => {
  for (const id of merchantIds) await serviceDb.delete(merchants).where(eq(merchants.id, id));
  await deleteAuthUsers(users);
  await closeDb();
});

describe("order board", () => {
  it("shows open orders from any day, only for the member's own shop", async () => {
    const board = await loadBoard(await ctxFor(a));
    expect(board.open.map((o) => o.id)).toEqual([a.orderId]);
    expect(board.open[0]).toMatchObject({ number: 101, status: "new", customerName: "Amine" });
    // Shop A's owner pointed at shop B's id: RLS returns nothing.
    const spoofed = { ...(await ctxFor(a)), merchant: { ...(await ctxFor(b)).merchant } };
    expect((await loadBoard(spoofed)).open).toEqual([]);
    expect(await countNewOrders(await ctxFor(a))).toBe(1);
    expect(await countNewOrders(spoofed)).toBe(0);
  });

  it("totals a business day and falls back to today on a bad date", async () => {
    await serviceDb.update(orders).set({ status: "completed" }).where(eq(orders.id, a.orderId));
    const day = await loadHistory(await ctxFor(a), { date: "2026-10-13" });
    expect(day.totals).toMatchObject({
      orders: 1,
      completed: 1,
      canceled: 0,
      collectedMinor: 15000,
      averageMinor: 15000,
    });
    expect(day.orders).toHaveLength(1);
    const filtered = await loadHistory(await ctxFor(a), { date: "2026-10-13", status: "canceled" });
    expect(filtered.orders).toHaveLength(0);
    expect(filtered.totals.orders).toBe(1); // totals ignore filters
    const byNumber = await loadHistory(await ctxFor(a), { date: "2026-10-13", q: "101" });
    expect(byNumber.orders).toHaveLength(1);
    const bad = await loadHistory(await ctxFor(a), { date: "2026-13-45" });
    expect(bad.date).not.toBe("2026-13-45");
    await serviceDb.update(orders).set({ status: "new" }).where(eq(orders.id, a.orderId));
  });
});

describe("staff invitations", () => {
  it("invites, refuses the wrong account, and lets the invited address join once", async () => {
    const owner = await ctxFor(a);
    const invitee = await user("invitee");
    const stranger = await user("stranger");
    const r = await inviteStaff(owner, { email: invitee.email.toUpperCase() }, "fr");
    if (!r.ok) throw new Error(r.error);
    expect(r.email).toBe(invitee.email);
    expect(r.link).toMatch(/\/fr\/invite\/[A-Za-z0-9_-]{43}$/);
    const token = tokenOf(r.link);
    expect(await loadInvitation(token)).toMatchObject({ state: "valid", email: invitee.email });

    expect(await acceptInvitation(stranger, token)).toEqual({ ok: false, error: "wrongAccount" });
    expect(await acceptInvitation(invitee, token)).toEqual({ ok: true });
    expect(await acceptInvitation(invitee, token)).toEqual({ ok: false, error: "invalid" });
    expect(await loadInvitation(token)).toEqual({ state: "invalid" });

    const [m] = await serviceDb
      .select({ role: merchantMembers.role })
      .from(merchantMembers)
      .where(
        and(eq(merchantMembers.merchantId, a.merchantId), eq(merchantMembers.userId, invitee.id)),
      );
    expect(m?.role).toBe("staff");
    // The new staff member sees the board through RLS.
    expect((await loadBoard(await ctxFor(a, invitee.id, "staff"))).open).toHaveLength(1);

    expect(await inviteStaff(owner, { email: invitee.email }, "fr")).toEqual({
      ok: false,
      error: "already",
    });
    expect(await inviteStaff(owner, { email: owner.user.email }, "fr")).toEqual({
      ok: false,
      error: "self",
    });
    expect(await inviteStaff(owner, { email: "not-an-email" }, "fr")).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("counts pending invites against the plan's staff seats; revoking frees a seat", async () => {
    const owner = await ctxFor(a);
    // One staff member joined above; the plan has 2 seats.
    const one = await inviteStaff(owner, { email: "seat-one@test.ranna.local" }, "en");
    expect(one.ok).toBe(true);
    expect(await inviteStaff(owner, { email: "seat-two@test.ranna.local" }, "en")).toEqual({
      ok: false,
      error: "seats",
    });
    const staff = await loadStaff(owner);
    expect(staff).toMatchObject({ maxStaff: 2, usedSeats: 2 });
    const pending = staff.invitations.find((i) => i.email === "seat-one@test.ranna.local")!;
    expect(await revokeInvitation(owner, pending.id)).toEqual({ ok: true });
    if (one.ok) expect(await loadInvitation(tokenOf(one.link))).toEqual({ state: "invalid" });
    expect((await inviteStaff(owner, { email: "seat-two@test.ranna.local" }, "en")).ok).toBe(true);
  });

  it("keeps shops apart and protects owners", async () => {
    const ownerA = await ctxFor(a);
    const ownerB = await ctxFor(b);
    const staffA = (await loadStaff(ownerA)).members.find((m) => m.role === "staff")!;
    // B's owner can't remove A's staff, or revoke A's invitations.
    expect(await removeMember(ownerB, staffA.id)).toEqual({ ok: false });
    const inviteA = (await loadStaff(ownerA)).invitations[0]!;
    expect(await revokeInvitation(ownerB, inviteA.id)).toEqual({ ok: false });
    // Staff can't invite; nobody removes an owner through this path.
    expect(
      await inviteStaff(
        await ctxFor(a, staffA.userId, "staff"),
        { email: "x@test.ranna.local" },
        "en",
      ),
    ).toEqual({
      ok: false,
      error: "forbidden",
    });
    const ownerRow = (await loadStaff(ownerA)).members.find((m) => m.role === "owner")!;
    expect(await removeMember(ownerA, ownerRow.id)).toEqual({ ok: false });
    // A's owner removes their staff member: access to the board ends.
    expect(await removeMember(ownerA, staffA.id)).toEqual({ ok: true });
    expect((await loadBoard(await ctxFor(a, staffA.userId, "staff"))).open).toEqual([]);
  });
});
