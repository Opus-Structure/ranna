import "server-only";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { serviceDb } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import type { I18nText, PlanLimits } from "@/lib/db/schema/types";

export type PublicPlan = {
  code: string;
  name: string;
  nameI18n: I18nText;
  priceMinor: number;
  currency: string;
  interval: "month" | "year";
  trialDays: number;
  limits: PlanLimits;
};

/** The plans on sale, as configured by the platform admin (cached for five minutes). */
export const getPublicPlans = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    const rows = await serviceDb
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.sort));
    return rows.map((p) => ({
      code: p.code,
      name: p.name,
      nameI18n: p.nameI18n,
      priceMinor: p.priceMinor,
      currency: p.currency,
      interval: p.interval,
      trialDays: p.trialDays,
      limits: p.limits,
    }));
  },
  ["public-plans"],
  { revalidate: 300, tags: ["plans"] },
);
