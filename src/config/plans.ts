import type { I18nText, PlanLimits } from "@/lib/db/schema/types";

/**
 * Subscription plans, seeded into the `plans` table by `npm run seed` and editable later in
 * /admin/plans. Prices and allowances follow the owner's revised sheet (2026-10-15): one yearly
 * price per pack, 15 days free to start (no card, after the commercial register is submitted), the middle pack positioned as the main offer. Amounts are minor units: 399900 = 3 999 DZD.
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
    priceMinor: 499900,
    currency: "DZD",
    interval: "year",
    trialDays: 15,
    // The entry pack: deliberately tight, so the middle pack is the natural choice.
    limits: { maxItems: 15, maxStaff: 1, maxMonthlyOrders: null, maxTables: 5 },
    sort: 1,
  },
  {
    code: "diamant",
    name: "Pack Diamant",
    nameI18n: { ar: "باقة دياماند", fr: "Pack Diamant", en: "Diamant pack" },
    priceMinor: 799900,
    currency: "DZD",
    interval: "year",
    trialDays: 15,
    // The pack most restaurants should take (highlighted on the pricing page).
    limits: { maxItems: 50, maxStaff: 5, maxMonthlyOrders: null, maxTables: 25 },
    sort: 2,
  },
  {
    code: "pro",
    name: "Pack Professionnel",
    nameI18n: { ar: "الباقة الاحترافية", fr: "Pack Professionnel", en: "Professional pack" },
    priceMinor: 1799900,
    currency: "DZD",
    interval: "year",
    trialDays: 15,
    // Unlimited dishes and table QR codes, a bigger team.
    limits: { maxItems: UNLIMITED_ITEMS, maxStaff: 15, maxMonthlyOrders: null, maxTables: null },
    sort: 3,
  },
];
