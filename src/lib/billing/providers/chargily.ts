import { z } from "zod";
import { hmacSha256Hex, safeEqualHex } from "./signature";
import { WebhookSignatureError, type PaymentProvider, type ProviderWebhookEvent } from "./types";

/**
 * Chargily Pay V2 (EDAHABIA / CIB cards, Algeria). Verified against dev.chargily.com (D62):
 *  - base URL https://pay.chargily.net/test/api/v2 (test) or /api/v2 (live); the secret key's
 *    mode must match the URL
 *  - POST /checkouts with `Authorization: Bearer <secret key>`, body amount + currency "dzd",
 *    success_url, failure_url, webhook_endpoint, locale, description, metadata
 *  - webhooks: header `signature` = hex HMAC-SHA256 of the raw body keyed with the secret key;
 *    events checkout.paid / checkout.failed / checkout.canceled with the checkout in `data`
 * Not stated by the docs: the unit of `amount`. Their examples are whole dinars, so whole
 * dinars are sent (our minor units / 100) and must be confirmed with a test payment.
 */
export const CHARGILY_SIGNATURE_HEADER = "signature";

export function chargilyBaseUrl(mode: "test" | "live"): string {
  return mode === "live"
    ? "https://pay.chargily.net/api/v2"
    : "https://pay.chargily.net/test/api/v2";
}

/** Our integer minor units (centimes) → Chargily's whole dinars. Refuses non-whole amounts. */
export function toChargilyAmount(amountMinor: number, currency: string): number {
  if (currency.toUpperCase() !== "DZD") throw new Error("Chargily only accepts DZD");
  if (amountMinor % 100 !== 0) throw new Error("Chargily amounts must be whole dinars");
  return amountMinor / 100;
}

const checkoutResponse = z.object({ id: z.string().min(1), checkout_url: z.string().url() });

// Metadata is documented both as a dictionary and as an array of pairs: accept either.
const metadata = z
  .union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
  .nullish()
  .transform(
    (m) => (Array.isArray(m) ? Object.assign({}, ...m) : (m ?? {})) as Record<string, unknown>,
  );

const webhookBody = z.object({
  id: z.string().min(1).max(200),
  type: z.string().max(100),
  livemode: z.union([z.boolean(), z.string()]).optional(),
  data: z.object({
    id: z.string().min(1).max(200),
    status: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    metadata,
  }),
});

const eventTypes: Record<string, ProviderWebhookEvent["type"]> = {
  "checkout.paid": "payment.succeeded",
  "checkout.failed": "payment.failed",
  "checkout.canceled": "payment.canceled",
};

export function createChargilyProvider({
  secretKey,
  mode,
  fetchImpl = fetch,
}: {
  secretKey: string;
  mode: "test" | "live";
  fetchImpl?: typeof fetch;
}): PaymentProvider {
  return {
    id: "chargily",
    kind: "redirect",
    async startCheckout(input) {
      const res = await fetchImpl(`${chargilyBaseUrl(mode)}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: toChargilyAmount(input.amountMinor, input.currency),
          currency: "dzd",
          success_url: input.successUrl,
          failure_url: input.failureUrl,
          webhook_endpoint: input.webhookUrl,
          locale: input.locale,
          description: input.invoiceNumber,
          metadata: { payment_id: input.paymentId, invoice: input.invoiceNumber },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`chargily checkout failed: http_${res.status}`);
      const body = checkoutResponse.parse(await res.json());
      return { redirectUrl: body.checkout_url, providerRef: body.id };
    },
    async parseWebhook(rawBody, headers): Promise<ProviderWebhookEvent> {
      // Signed over the exact bytes received: never re-serialise before checking.
      const signature = headers.get(CHARGILY_SIGNATURE_HEADER) ?? "";
      if (!safeEqualHex(signature, hmacSha256Hex(secretKey, rawBody)))
        throw new WebhookSignatureError();
      const parsed = webhookBody.safeParse(JSON.parse(rawBody));
      if (!parsed.success) throw new WebhookSignatureError("malformed chargily webhook");
      const e = parsed.data;
      const live = e.livemode === true || e.livemode === "true";
      // A test-mode event must never settle a live payment (and vice versa).
      const sameMode = e.livemode === undefined || live === (mode === "live");
      const type = sameMode ? (eventTypes[e.type] ?? "ignored") : "ignored";
      const paymentId =
        typeof e.data.metadata.payment_id === "string" ? e.data.metadata.payment_id : null;
      return {
        eventId: e.id,
        type,
        providerRef: e.data.id,
        paymentId,
        // Whole dinars back to centimes, for the amount check in the webhook pipeline.
        amountMinor: e.data.amount !== undefined ? Math.round(e.data.amount * 100) : undefined,
        currency: e.data.currency?.toUpperCase(),
      };
    },
  };
}
