import { sql, type SQL } from "drizzle-orm";
import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

/* ---------- enums ---------- */

export const merchantStatus = pgEnum("merchant_status", [
  "pending_payment",
  "active",
  "past_due",
  "suspended",
  "canceled",
]);

export const memberRole = pgEnum("member_role", ["owner", "staff"]);

/** What a staff member may open: the order board or the kitchen screen (owners see everything). */
export const staffAccess = pgEnum("staff_access", ["orders", "kitchen"]);

export const orderStatus = pgEnum("order_status", [
  "new",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "canceled",
]);

export const invoiceStatus = pgEnum("invoice_status", ["open", "paid", "void", "failed"]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "pending_review",
  "succeeded",
  "failed",
  "rejected",
]);

export const paymentProvider = pgEnum("payment_provider", ["mock", "manual", "chargily"]);

export const pushStatus = pgEnum("push_status", ["active", "expired", "failed"]);

export const notificationChannel = pgEnum("notification_channel", [
  "push",
  "sms",
  "whatsapp",
  "inpage",
]);

export const notificationStatus = pgEnum("notification_status", ["sent", "failed", "skipped"]);

/* ---------- column helpers ---------- */

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ---------- RLS predicates ----------
 * The helper functions live in db/migrations/20261013000000_rls_helpers.sql.
 * `(select fn())` lets Postgres evaluate them once per statement instead of once per row.
 */

export const isAdmin: SQL = sql`(select public.is_platform_admin())`;
export const memberOf: SQL = sql`merchant_id in (select public.member_merchant_ids())`;
export const ownerOf: SQL = sql`merchant_id in (select public.owner_merchant_ids())`;
export const memberOrAdmin: SQL = sql`(${memberOf} or ${isAdmin})`;
export const ownerOrAdmin: SQL = sql`(${ownerOf} or ${isAdmin})`;
