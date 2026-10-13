import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import {
  createdAt,
  id,
  memberOf,
  memberOrAdmin,
  notificationChannel,
  notificationStatus,
  orderStatus,
  pushStatus,
  timestamps,
} from "./_shared";
import { merchants } from "./accounts";
import { items } from "./menu";
import type { OrderItemOptionSnapshot } from "./types";

const merchantRef = () =>
  uuid("merchant_id")
    .notNull()
    .references(() => merchants.id, { onDelete: "cascade" });

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Atomic per-day order number allocator. Service-only. */
export const orderCounters = pgTable(
  "order_counters",
  {
    merchantId: merchantRef(),
    businessDate: date("business_date").notNull(),
    lastNumber: integer("last_number").notNull(),
  },
  (t) => [primaryKey({ columns: [t.merchantId, t.businessDate] })],
).enableRLS();

export const orders = pgTable(
  "orders",
  {
    id: id(),
    merchantId: merchantRef(),
    number: integer("number").notNull(),
    businessDate: date("business_date").notNull(),
    /** sha256 of the 128-bit customer token. The raw token is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    /** Client-generated id that makes "Place order" idempotent on double taps. */
    clientRequestId: uuid("client_request_id").notNull(),
    status: orderStatus("status").notNull().default("new"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    tableLabel: text("table_label"),
    note: text("note"),
    locale: text("locale").notNull().default("ar"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull(),
    paymentMethod: text("payment_method", { enum: ["counter"] })
      .notNull()
      .default("counter"),
    cancelReason: text("cancel_reason"),
    placedAt: ts("placed_at").notNull().defaultNow(),
    acceptedAt: ts("accepted_at"),
    preparingAt: ts("preparing_at"),
    readyAt: ts("ready_at"),
    completedAt: ts("completed_at"),
    canceledAt: ts("canceled_at"),
    acknowledgedAt: ts("acknowledged_at"),
    lastRungAt: ts("last_rung_at"),
    ringCount: integer("ring_count").notNull().default(0),
    phonePurgedAt: ts("phone_purged_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("orders_merchant_day_number_key").on(t.merchantId, t.businessDate, t.number),
    uniqueIndex("orders_merchant_client_request_key").on(t.merchantId, t.clientRequestId),
    index("orders_merchant_status_idx").on(t.merchantId, t.status, t.placedAt),
    index("orders_merchant_placed_idx").on(t.merchantId, t.placedAt),
    index("orders_phone_purge_idx")
      .on(t.placedAt)
      .where(sql`customer_phone is not null`),
    pgPolicy("orders_select_member", {
      for: "select",
      to: authenticatedRole,
      using: memberOrAdmin,
    }),
    // Column grants restrict members to status fields; transitions are validated in code.
    pgPolicy("orders_update_member", {
      for: "update",
      to: authenticatedRole,
      using: memberOf,
      withCheck: memberOf,
    }),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    merchantId: merchantRef(),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    quantity: integer("quantity").notNull(),
    options: jsonb("options").$type<OrderItemOptionSnapshot[]>().notNull().default([]),
    lineTotalMinor: integer("line_total_minor").notNull(),
    note: text("note"),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    pgPolicy("order_items_select_member", {
      for: "select",
      to: authenticatedRole,
      using: memberOrAdmin,
    }),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    merchantId: merchantRef(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    status: pushStatus("status").notNull().default("active"),
    failureCount: integer("failure_count").notNull().default(0),
    lastSuccessAt: ts("last_success_at"),
    lastFailureAt: ts("last_failure_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_order_endpoint_key").on(t.orderId, t.endpoint),
    index("push_subscriptions_merchant_idx").on(t.merchantId),
    // Column grants hide endpoint and keys from members.
    pgPolicy("push_subscriptions_select_member", {
      for: "select",
      to: authenticatedRole,
      using: memberOrAdmin,
    }),
  ],
);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    merchantId: merchantRef(),
    channel: notificationChannel("channel").notNull(),
    kind: text("kind", { enum: ["ready", "rering", "acknowledged"] }).notNull(),
    status: notificationStatus("status").notNull(),
    statusCode: integer("status_code"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notification_events_order_idx").on(t.orderId, t.createdAt),
    pgPolicy("notification_events_select_member", {
      for: "select",
      to: authenticatedRole,
      using: memberOrAdmin,
    }),
  ],
);

/** Fixed-window rate-limit counters. Service-only. */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    index("rate_limit_buckets_window_idx").on(t.windowStart),
  ],
).enableRLS();
