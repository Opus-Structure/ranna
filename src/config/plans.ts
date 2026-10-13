import type { I18nText, PlanLimits } from "@/lib/db/schema/types";

/**
 * Subscription plans, seeded into the `plans` table by `npm run seed`.
 * PRICES ARE PLACEHOLDERS, not a commercial decision. Change them here (or in /admin/plans)
 * before launch. Amounts are minor units: 290000 = 2 900 DZD.
 */
export type PlanSeed = {
  code: "starter" | "pro" | "business";
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
    name: "Starter",
    nameI18n: { ar: "البداية", fr: "Essentiel", en: "Starter" },
    priceMinor: 290000,
    currency: "DZD",
    interval: "month",
    trialDays: 14,
    limits: { maxItems: 40, maxStaff: 2, maxMonthlyOrders: 1500 },
    sort: 1,
  },
  {
    code: "pro",
    name: "Pro",
    nameI18n: { ar: "المحترف", fr: "Pro", en: "Pro" },
    priceMinor: 590000,
    currency: "DZD",
    interval: "month",
    trialDays: 14,
    limits: { maxItems: 150, maxStaff: 6, maxMonthlyOrders: 6000 },
    sort: 2,
  },
  {
    code: "business",
    name: "Business",
    nameI18n: { ar: "الأعمال", fr: "Business", en: "Business" },
    priceMinor: 1190000,
    currency: "DZD",
    interval: "month",
    trialDays: 0,
    limits: { maxItems: 500, maxStaff: 20, maxMonthlyOrders: null },
    sort: 3,
  },
];
