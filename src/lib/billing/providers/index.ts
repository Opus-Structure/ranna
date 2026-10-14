import "server-only";
import { appUrl } from "@/config/brand";
import { serverEnv } from "@/lib/env";
import { createChargilyProvider } from "./chargily";
import { createMockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type ProviderId = PaymentProvider["id"];

const manualProvider: PaymentProvider = { id: "manual", kind: "manual" };

/** Providers switched on by PAYMENT_PROVIDERS (e.g. "chargily,manual" in production). */
export function enabledProviderIds(): ProviderId[] {
  const raw = serverEnv()
    .PAYMENT_PROVIDERS.split(",")
    .map((s) => s.trim());
  return (["chargily", "manual", "mock"] as const).filter(
    // Chargily is only offered once its secret key is configured.
    (id) => raw.includes(id) && (id !== "chargily" || Boolean(serverEnv().CHARGILY_SECRET_KEY)),
  );
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
    case "chargily":
      // Without a key the provider stays off rather than failing at checkout time.
      return env.CHARGILY_SECRET_KEY
        ? createChargilyProvider({ secretKey: env.CHARGILY_SECRET_KEY, mode: env.CHARGILY_MODE })
        : null;
    default:
      return null;
  }
}
