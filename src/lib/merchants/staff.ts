import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import { authUsers } from "@/lib/db/schema/_platform";
import { z } from "zod";
import { appUrl, brandName } from "@/config/brand";
import { writeAudit } from "@/lib/audit/log";
import { localizedPath } from "@/lib/auth/paths";
import type { SessionUser } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/client";
import { merchantMembers, merchants, plans, staffInvitations } from "@/lib/db/schema";
import { translatorFor } from "@/lib/i18n/translator";
import { sendSafely } from "@/lib/mail/mailer";
import { checkLimit } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation/auth";
import type { MerchantContext, StaffAccess } from "./context";

/** Invitation links are bearer secrets: 256 bits, stored only as a hash, valid for 7 days. */
export const INVITE_TTL_DAYS = 7;
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

const hashInvite = (token: string) => createHash("sha256").update(token).digest("hex");

export type StaffMember = {
  id: string;
  userId: string;
  email: string;
  role: "owner" | "staff";
  access: StaffAccess;
  since: string;
};
export type PendingInvite = {
  id: string;
  email: string;
  access: StaffAccess;
  expiresAt: string;
  expired: boolean;
};
export type StaffOverview = {
  members: StaffMember[];
  invitations: PendingInvite[];
  /** Staff seats on the plan (owners don't count); null when no plan is attached yet. */
  maxStaff: number | null;
  usedSeats: number;
};

function assertOwner(ctx: MerchantContext) {
  if (ctx.role !== "owner") throw new Error("owner only");
}

/**
 * Team list for the owner. Emails live in `neon_auth."user"`, which RLS never exposes, so this reads
 * with the service connection, strictly scoped to the owner's own shop.
 */
export async function loadStaff(ctx: MerchantContext, now = new Date()): Promise<StaffOverview> {
  assertOwner(ctx);
  const members = await serviceDb
    .select({
      id: merchantMembers.id,
      userId: merchantMembers.userId,
      email: authUsers.email,
      role: merchantMembers.role,
      access: merchantMembers.access,
      since: merchantMembers.createdAt,
    })
    .from(merchantMembers)
    .innerJoin(authUsers, eq(authUsers.id, merchantMembers.userId))
    .where(eq(merchantMembers.merchantId, ctx.merchant.id))
    .orderBy(
      sql`case when ${merchantMembers.role} = 'owner' then 0 else 1 end`,
      asc(merchantMembers.createdAt),
    );
  const invites = await serviceDb
    .select({
      id: staffInvitations.id,
      email: staffInvitations.email,
      access: staffInvitations.access,
      expiresAt: staffInvitations.expiresAt,
    })
    .from(staffInvitations)
    .where(
      and(eq(staffInvitations.merchantId, ctx.merchant.id), isNull(staffInvitations.acceptedAt)),
    )
    .orderBy(asc(staffInvitations.createdAt));
  const maxStaff = await staffSeats(ctx.merchant.id);
  const invitations = invites.map((i) => ({
    id: i.id,
    email: i.email,
    access: i.access,
    expiresAt: i.expiresAt.toISOString(),
    expired: i.expiresAt <= now,
  }));
  return {
    members: members.map((m) => ({ ...m, email: m.email ?? "", since: m.since.toISOString() })),
    invitations,
    maxStaff,
    usedSeats:
      members.filter((m) => m.role === "staff").length +
      invitations.filter((i) => !i.expired).length,
  };
}

async function staffSeats(merchantId: string): Promise<number | null> {
  const [row] = await serviceDb
    .select({ limits: plans.limits })
    .from(merchants)
    .leftJoin(plans, eq(plans.id, merchants.planId))
    .where(eq(merchants.id, merchantId));
  return row?.limits?.maxStaff ?? null;
}

export type InviteError = "invalid" | "seats" | "already" | "self" | "rateLimited" | "forbidden";
export type InviteResult =
  { ok: true; email: string; link: string } | { ok: false; error: InviteError };

const inviteSchema = z.object({
  email: emailSchema,
  access: z.enum(["orders", "kitchen"]).default("orders"),
});

/**
 * Invites one person as staff. Re-inviting the same address replaces the earlier link. The
 * link is emailed and also returned once, so the owner can pass it on by hand (WhatsApp, SMS)
 * when email is unreliable.
 */
export async function inviteStaff(
  ctx: MerchantContext,
  raw: unknown,
  locale: string,
  now = new Date(),
): Promise<InviteResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { email, access } = parsed.data;
  if (email === ctx.user.email?.toLowerCase()) return { ok: false, error: "self" };
  const limit = await checkLimit("staffInvite", `merchant:${ctx.merchant.id}`);
  if (!limit.ok) return { ok: false, error: "rateLimited" };

  const token = randomBytes(32).toString("base64url");
  const result = await serviceDb.transaction(async (tx) => {
    // One invite at a time per shop, so two parallel invites can't both take the last seat.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`staff-invite:${ctx.merchant.id}`}, 0))`,
    );
    const [member] = await tx
      .select({ id: merchantMembers.id })
      .from(merchantMembers)
      .innerJoin(authUsers, eq(authUsers.id, merchantMembers.userId))
      .where(
        and(
          eq(merchantMembers.merchantId, ctx.merchant.id),
          sql`lower(${authUsers.email}) = ${email}`,
        ),
      );
    if (member) return { ok: false, error: "already" } as const;

    await tx
      .delete(staffInvitations)
      .where(
        and(
          eq(staffInvitations.merchantId, ctx.merchant.id),
          eq(staffInvitations.email, email),
          isNull(staffInvitations.acceptedAt),
        ),
      );
    const [staff] = await tx
      .select({ n: count() })
      .from(merchantMembers)
      .where(
        and(eq(merchantMembers.merchantId, ctx.merchant.id), eq(merchantMembers.role, "staff")),
      );
    const [pending] = await tx
      .select({ n: count() })
      .from(staffInvitations)
      .where(
        and(
          eq(staffInvitations.merchantId, ctx.merchant.id),
          isNull(staffInvitations.acceptedAt),
          gt(staffInvitations.expiresAt, now),
        ),
      );
    const seats = await staffSeats(ctx.merchant.id);
    if (seats !== null && Number(staff?.n ?? 0) + Number(pending?.n ?? 0) >= seats) {
      return { ok: false, error: "seats" } as const;
    }
    await tx.insert(staffInvitations).values({
      merchantId: ctx.merchant.id,
      email,
      role: "staff",
      access,
      tokenHash: hashInvite(token),
      invitedBy: ctx.user.id,
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000),
    });
    await writeAudit(tx, {
      merchantId: ctx.merchant.id,
      actorUserId: ctx.user.id,
      actorType: "user",
      action: "staff.invited",
      details: { email, access },
    });
    return { ok: true } as const;
  });
  if (!result.ok) return result;

  const { t, locale: l } = translatorFor(locale);
  const link = `${appUrl()}${localizedPath(`/invite/${token}`, l)}`;
  await sendSafely({
    to: email,
    subject: t("staff.email.subject", { shop: ctx.merchant.name, brand: brandName(l) }),
    text: t("staff.email.body", {
      shop: ctx.merchant.name,
      brand: brandName(l),
      inviter: ctx.user.email ?? "",
      link,
      days: INVITE_TTL_DAYS,
    }),
  });
  return { ok: true, email, link };
}

export async function revokeInvitation(ctx: MerchantContext, id: string): Promise<{ ok: boolean }> {
  if (ctx.role !== "owner" || !z.uuid().safeParse(id).success) return { ok: false };
  const removed = await serviceDb
    .delete(staffInvitations)
    .where(and(eq(staffInvitations.id, id), eq(staffInvitations.merchantId, ctx.merchant.id)))
    .returning({ id: staffInvitations.id });
  return { ok: removed.length > 0 };
}

/** Removes a staff member. Owners can't be removed here (that would orphan the shop). */
export async function removeMember(
  ctx: MerchantContext,
  memberId: string,
): Promise<{ ok: boolean }> {
  if (ctx.role !== "owner" || !z.uuid().safeParse(memberId).success) return { ok: false };
  const removed = await serviceDb
    .delete(merchantMembers)
    .where(
      and(
        eq(merchantMembers.id, memberId),
        eq(merchantMembers.merchantId, ctx.merchant.id),
        eq(merchantMembers.role, "staff"),
      ),
    )
    .returning({ userId: merchantMembers.userId });
  if (removed[0]) {
    await writeAudit(serviceDb, {
      merchantId: ctx.merchant.id,
      actorUserId: ctx.user.id,
      actorType: "user",
      action: "staff.removed",
      details: { userId: removed[0].userId },
    });
  }
  return { ok: removed.length > 0 };
}

export type InvitationView =
  { state: "valid"; shopName: string; email: string } | { state: "invalid" };

/** What the invite page shows. Unknown, expired, revoked and used links look the same. */
export async function loadInvitation(token: string, now = new Date()): Promise<InvitationView> {
  if (!INVITE_TOKEN.test(token)) return { state: "invalid" };
  const [row] = await serviceDb
    .select({ email: staffInvitations.email, shopName: merchants.name })
    .from(staffInvitations)
    .innerJoin(merchants, eq(merchants.id, staffInvitations.merchantId))
    .where(
      and(
        eq(staffInvitations.tokenHash, hashInvite(token)),
        isNull(staffInvitations.acceptedAt),
        gt(staffInvitations.expiresAt, now),
      ),
    );
  return row ? { state: "valid", shopName: row.shopName, email: row.email } : { state: "invalid" };
}

export type AcceptResult = { ok: true } | { ok: false; error: "invalid" | "wrongAccount" };

/**
 * Joins the shop as staff. The signed-in account's email must be the invited one: the link
 * alone isn't enough, so a forwarded link can't be used by someone else.
 */
export async function acceptInvitation(
  user: SessionUser,
  token: string,
  now = new Date(),
): Promise<AcceptResult> {
  if (!INVITE_TOKEN.test(token)) return { ok: false, error: "invalid" };
  return serviceDb.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.tokenHash, hashInvite(token)))
      .for("update");
    if (!inv || inv.acceptedAt || inv.expiresAt <= now)
      return { ok: false, error: "invalid" } as const;
    if ((user.email ?? "").toLowerCase() !== inv.email.toLowerCase()) {
      return { ok: false, error: "wrongAccount" } as const;
    }
    await tx
      .insert(merchantMembers)
      .values({ merchantId: inv.merchantId, userId: user.id, role: inv.role, access: inv.access })
      .onConflictDoNothing();
    await tx
      .update(staffInvitations)
      .set({ acceptedAt: now })
      .where(eq(staffInvitations.id, inv.id));
    await writeAudit(tx, {
      merchantId: inv.merchantId,
      actorUserId: user.id,
      actorType: "user",
      action: "staff.joined",
    });
    return { ok: true } as const;
  });
}
