import {
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "./_platform";
import { createdAt, id, memberOrAdmin, ownerOf, timestamps } from "./_shared";
import { merchants } from "./accounts";
import type { I18nText } from "./types";

/** Members read the menu; only owners write it. */
const menuPolicies = (table: string) => [
  pgPolicy(`${table}_select_member`, {
    for: "select",
    to: authenticatedRole,
    using: memberOrAdmin,
  }),
  pgPolicy(`${table}_insert_owner`, { for: "insert", to: authenticatedRole, withCheck: ownerOf }),
  pgPolicy(`${table}_update_owner`, {
    for: "update",
    to: authenticatedRole,
    using: ownerOf,
    withCheck: ownerOf,
  }),
  pgPolicy(`${table}_delete_owner`, { for: "delete", to: authenticatedRole, using: ownerOf }),
];

const merchantRef = () =>
  uuid("merchant_id")
    .notNull()
    .references(() => merchants.id, { onDelete: "cascade" });

export const categories = pgTable(
  "categories",
  {
    id: id(),
    merchantId: merchantRef(),
    name: text("name").notNull(),
    nameI18n: jsonb("name_i18n").$type<I18nText>().notNull().default({}),
    sort: integer("sort").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("categories_merchant_idx").on(t.merchantId, t.sort), ...menuPolicies("categories")],
);

export const items = pgTable(
  "items",
  {
    id: id(),
    merchantId: merchantRef(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameI18n: jsonb("name_i18n").$type<I18nText>().notNull().default({}),
    description: text("description"),
    descriptionI18n: jsonb("description_i18n").$type<I18nText>().notNull().default({}),
    priceMinor: integer("price_minor").notNull(),
    imagePath: text("image_path"),
    isAvailable: boolean("is_available").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("items_merchant_idx").on(t.merchantId),
    index("items_category_idx").on(t.categoryId, t.sort),
    ...menuPolicies("items"),
  ],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: id(),
    merchantId: merchantRef(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameI18n: jsonb("name_i18n").$type<I18nText>().notNull().default({}),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("option_groups_item_idx").on(t.itemId, t.sort), ...menuPolicies("option_groups")],
);

export const options = pgTable(
  "options",
  {
    id: id(),
    merchantId: merchantRef(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameI18n: jsonb("name_i18n").$type<I18nText>().notNull().default({}),
    priceDeltaMinor: integer("price_delta_minor").notNull().default(0),
    isAvailable: boolean("is_available").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("options_group_idx").on(t.groupId, t.sort), ...menuPolicies("options")],
);

export const qrCodes = pgTable(
  "qr_codes",
  {
    id: id(),
    merchantId: merchantRef(),
    label: text("label").notNull(),
    /** Value of the `?t=` parameter. Null for the main shop QR. */
    tableCode: text("table_code"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("qr_codes_merchant_table_key").on(t.merchantId, t.tableCode),
    ...menuPolicies("qr_codes"),
  ],
);
