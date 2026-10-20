import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
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
  isAdmin,
  memberOrAdmin,
  memberRole,
  merchantStatus,
  ownerOf,
  ownerOrAdmin,
  timestamps,
} from "./_shared";
import type { MerchantBranding, MerchantSettings, PlanLimits, I18nText } from "./types";

/** One row per auth user. Created by the app on a user's first request (getSessionUser). */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    locale: text("locale").notNull().default("ar"),
    /** Only settable from SQL or the seed script. No API path writes it. */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    ...timestamps(),
  },
  () => [
    pgPolicy("profiles_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`id = (select auth.uid()) or ${isAdmin}`,
    }),
    pgPolicy("profiles_update_self", {
      for: "update",
      to: authenticatedRole,
      using: sql`id = (select auth.uid())`,
      withCheck: sql`id = (select auth.uid())`,
    }),
  ],
);

/**
 * What a new owner asked for at sign-up (the shop name, the language). Managed Better Auth keeps
 * no free-form user metadata, and a magic-link sign-up creates its user only when the link is
 * clicked, so the sign-up action stores it here, keyed by lowercased email, and the console reads
 * and deletes it on the account's first visit. Service-only: no grants, no policies.
 */
export const signupIntents = pgTable("signup_intents", {
  email: text("email").primaryKey(),
  shopName: text("shop_name"),
  locale: text("locale").notNull().default("ar"),
  createdAt: createdAt(),
}).enableRLS();

export const plans = pgTable(
  "plans",
  {
    id: id(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    nameI18n: jsonb("name_i18n").$type<I18nText>().notNull().default({}),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull().default("DZD"),
    interval: text("interval", { enum: ["month", "year"] })
      .notNull()
      .default("month"),
    intervalCount: integer("interval_count").notNull().default(1),
    trialDays: integer("trial_days").notNull().default(0),
    limits: jsonb("limits").$type<PlanLimits>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps(),
  },
  () => [
    pgPolicy("plans_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`is_active or ${isAdmin}`,
    }),
  ],
);

export const merchants = pgTable(
  "merchants",
  {
    id: id(),
    /** Null until the setup wizard runs. Lowercase, validated by `src/lib/slug.ts`. */
    slug: text("slug"),
    name: text("name").notNull(),
    status: merchantStatus("status").notNull().default("pending_payment"),
    planId: uuid("plan_id").references(() => plans.id),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    graceUntil: timestamp("grace_until", { withTimezone: true }),
    currency: text("currency").notNull().default("DZD"),
    defaultLocale: text("default_locale").notNull().default("ar"),
    locales: text("locales")
      .array()
      .notNull()
      .default(sql`'{ar}'::text[]`),
    timezone: text("timezone").notNull().default("Africa/Algiers"),
    phone: text("phone"),
    address: text("address"),
    branding: jsonb("branding").$type<MerchantBranding>().notNull().default({}),
    settings: jsonb("settings").$type<MerchantSettings>().notNull().default({}),
    isOpen: boolean("is_open").notNull().default(true),
    acceptingOrders: boolean("accepting_orders").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("merchants_slug_key").on(t.slug),
    index("merchants_status_idx").on(t.status),
    pgPolicy("merchants_select_member", {
      for: "select",
      to: authenticatedRole,
      using: sql`id in (select public.member_merchant_ids()) or ${isAdmin}`,
    }),
    // Column-level grants (security migration) limit which columns an owner can touch.
    pgPolicy("merchants_update_owner", {
      for: "update",
      to: authenticatedRole,
      using: sql`id in (select public.owner_merchant_ids())`,
      withCheck: sql`id in (select public.owner_merchant_ids())`,
    }),
  ],
);

export const merchantMembers = pgTable(
  "merchant_members",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("merchant_members_merchant_user_key").on(t.merchantId, t.userId),
    index("merchant_members_user_idx").on(t.userId),
    pgPolicy("merchant_members_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`user_id = (select auth.uid()) or ${ownerOrAdmin}`,
    }),
  ],
);

export const staffInvitations = pgTable(
  "staff_invitations",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull().default("staff"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by").references(() => authUsers.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("staff_invitations_merchant_idx").on(t.merchantId),
    pgPolicy("staff_invitations_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: ownerOrAdmin,
    }),
    pgPolicy("staff_invitations_delete_owner", {
      for: "delete",
      to: authenticatedRole,
      using: ownerOf,
    }),
  ],
);

/** Old slugs keep working: `/s/<old>` redirects to the merchant's current slug. */
export const slugRedirects = pgTable(
  "slug_redirects",
  {
    oldSlug: text("old_slug").primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("slug_redirects_merchant_idx").on(t.merchantId),
    pgPolicy("slug_redirects_select_member", {
      for: "select",
      to: authenticatedRole,
      using: memberOrAdmin,
    }),
  ],
);
