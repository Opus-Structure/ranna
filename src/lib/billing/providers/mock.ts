import { z } from "zod";
import { hmacSha256Hex, safeEqualHex } from "./signature";
import { WebhookSignatureError, type PaymentProvider, type ProviderWebhookEvent } from "./types";

/**
 * Local/test gateway. Its checkout page lives inside the console and its webhook is signed with
 * a key derived from APP_SECRET, so the full verify → idempotency → settle path runs for real.
 * Enabled only when PAYMENT_PROVIDERS includes "mock" (never in production).
 */
export const MOCK_SIGNATURE_HEADER = "x-mock-signature";

const bodySchema = z.object({
  id: z.string().min(8).max(100),
  type: z.enum(["payment.succeeded", "payment.failed", "payment.canceled"]),
  data: z.object({ providerRef: z.string().min(1).max(200), paymentId: z.string().uuid() }),
});

export type MockWebhookBody = z.infer<typeof bodySchema>;

export function mockSigningKey(appSecret: string): string {
  return `${appSecret}:mock-payments`;
}

export function signMockWebhook(rawBody: string, appSecret: string): string {
  return hmacSha256Hex(mockSigningKey(appSecret), rawBody);
}

export function createMockProvider({
  appSecret,
  checkoutUrl,
}: {
  appSecret: string;
  /** Builds the in-console checkout URL for a payment. */
  checkoutUrl: (paymentId: string) => string;
}): PaymentProvider {
  return {
    id: "mock",
    kind: "redirect",
    async startCheckout(input) {
      return { redirectUrl: checkoutUrl(input.paymentId), providerRef: `mock_${input.paymentId}` };
    },
    async parseWebhook(rawBody, headers): Promise<ProviderWebhookEvent> {
      const signature = headers.get(MOCK_SIGNATURE_HEADER) ?? "";
      if (!safeEqualHex(signature, signMockWebhook(rawBody, appSecret))) {
        throw new WebhookSignatureError();
      }
      const parsed = bodySchema.safeParse(JSON.parse(rawBody));
      if (!parsed.success) throw new WebhookSignatureError("malformed mock webhook");
      return {
        eventId: parsed.data.id,
        type: parsed.data.type,
        providerRef: parsed.data.data.providerRef,
        paymentId: parsed.data.data.paymentId,
      };
    },
  };
}
