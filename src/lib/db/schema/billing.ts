import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "./_platform";
import {
  createdAt,
  id,
  invoiceStatus,
  isAdmin,
  ownerOrAdmin,
  paymentProvider,
  paymentStatus,
  timestamps,
} from "./_shared";
import { merchants, plans } from "./accounts";

/** The merchant's current subscription. Written only by `applyAccountEvent`. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    /** Plan the merchant switches to at the next renewal. */
    pendingPlanId: uuid("pending_plan_id").references(() => plans.id),
    isTrial: boolean("is_trial").notNull().default(false),
    /** One free trial per merchant, ever. */
    trialUsed: boolean("trial_used").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("subscriptions_merchant_key").on(t.merchantId),
    pgPolicy("subscriptions_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: ownerOrAdmin,
    }),
  ],
);

/** Source of human invoice numbers (RN-2026-000042). Service-only. */
export const invoiceNumberSeq = pgSequence("invoice_number_seq", { startWith: 1, increment: 1 });

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** Human-readable, e.g. RN-2026-000042. */
    number: text("number").notNull().unique(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: invoiceStatus("status").notNull().default("open"),
    provider: paymentProvider("provider"),
    providerRef: text("provider_ref"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("invoices_merchant_idx").on(t.merchantId, t.createdAt),
    pgPolicy("invoices_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: ownerOrAdmin,
    }),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull(),
    /** Checkout id at the provider; null for manual payments. */
    providerRef: text("provider_ref"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    /** Manual payments: object path in the private `receipts` bucket. */
    receiptPath: text("receipt_path"),
    reference: text("reference"),
    reviewedBy: uuid("reviewed_by").references(() => authUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps(),
  },
  (t) => [
    index("payments_merchant_idx").on(t.merchantId, t.createdAt),
    index("payments_status_idx").on(t.status),
    uniqueIndex("payments_provider_ref_key")
      .on(t.provider, t.providerRef)
      .where(sql`provider_ref is not null`),
    pgPolicy("payments_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: ownerOrAdmin,
    }),
  ],
);

/** Idempotency ledger for provider webhooks. Service-only. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: paymentProvider("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_key").on(t.provider, t.eventId)],
).enableRLS();

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    actorType: text("actor_type", { enum: ["user", "admin", "system", "webhook"] }).notNull(),
    action: text("action").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_merchant_idx").on(t.merchantId, t.createdAt),
    pgPolicy("audit_logs_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: sql`merchant_id in (select public.owner_merchant_ids()) or ${isAdmin}`,
    }),
  ],
);
