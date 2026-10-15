import type { I18nText, PlanLimits } from "@/lib/db/schema/types";

/**
 * Subscription plans, seeded into the `plans` table by `npm run seed` and editable later in
 * /admin/plans. Prices and allowances follow the owner's price sheet (2026-10-15): one yearly
 * price per pack, 90 days free to start. Amounts are minor units: 399900 = 3 999 DZD.
 *
 * "Unlimited" menu items is stored as UNLIMITED_ITEMS (a number, so the limit column stays
 * simple) and shown as "unlimited" by `isUnlimitedItems`.
 */
export const UNLIMITED_ITEMS = 100_000;
export const isUnlimitedItems = (n: number) => n >= UNLIMITED_ITEMS;

export type PlanSeed = {
  code: "starter" | "diamant" | "pro";
  name: string;
  nameI18n: I18nText;
  priceMinor: number;
  currency: string;
  interval: "month" | "year";
  trialDays: number;
  limits: PlanLimits;
  sort: number;
};

export const planSeeds: PlanSeed[] = [
  {
    code: "starter",
    name: "Pack Starter",
    nameI18n: { ar: "باقة ستارتر", fr: "Pack Starter", en: "Starter pack" },
    priceMinor: 399900,
    currency: "DZD",
    interval: "year",
    trialDays: 90,
    // 5 menu categories of 10 dishes, 10 table QR codes.
    limits: { maxItems: 50, maxStaff: 2, maxMonthlyOrders: null, maxTables: 10 },
    sort: 1,
  },
  {
    code: "diamant",
    name: "Pack Diamant",
    nameI18n: { ar: "باقة دياماند", fr: "Pack Diamant", en: "Diamant pack" },
    priceMinor: 599900,
    currency: "DZD",
    interval: "year",
    trialDays: 90,
    // 10 menu categories of 50 dishes, 30 table QR codes.
    limits: { maxItems: 500, maxStaff: 5, maxMonthlyOrders: null, maxTables: 30 },
    sort: 2,
  },
  {
    code: "pro",
    name: "Pack Professionnel",
    nameI18n: { ar: "الباقة الاحترافية", fr: "Pack Professionnel", en: "Professional pack" },
    priceMinor: 1999900,
    currency: "DZD",
    interval: "year",
    trialDays: 90,
    // Unlimited categories and dishes, 30 table QR codes.
    limits: { maxItems: UNLIMITED_ITEMS, maxStaff: 10, maxMonthlyOrders: null, maxTables: 30 },
    sort: 3,
  },
];
