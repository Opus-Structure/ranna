import "server-only";
import { appUrl } from "@/config/brand";
import { serverEnv } from "@/lib/env";
import { createMockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type ProviderId = PaymentProvider["id"];

const manualProvider: PaymentProvider = { id: "manual", kind: "manual" };

/** Providers switched on by PAYMENT_PROVIDERS (e.g. "chargily,manual" in production). */
export function enabledProviderIds(): ProviderId[] {
  const raw = serverEnv()
    .PAYMENT_PROVIDERS.split(",")
    .map((s) => s.trim());
  return (["chargily", "manual", "mock"] as const).filter((id) => raw.includes(id));
}

export function getProvider(id: string): PaymentProvider | null {
  if (!(enabledProviderIds() as string[]).includes(id)) return null;
  const env = serverEnv();
  switch (id) {
    case "mock":
      return createMockProvider({
        appSecret: env.APP_SECRET,
        checkoutUrl: (paymentId) =>
          `${appUrl()}/dashboard/billing/checkout/mock?payment=${paymentId}`,
      });
    case "manual":
      return manualProvider;
    default:
      return null;
  }
}
