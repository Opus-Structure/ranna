import type { AppLocale } from "@/i18n/routing";

/** Normalised event from a provider webhook, after its signature was verified. */
export type ProviderWebhookEvent = {
  /** Provider's event id: the idempotency key in `webhook_events`. */
  eventId: string;
  type: "payment.succeeded" | "payment.failed" | "payment.canceled" | "ignored";
  /** Checkout / transaction id we stored on the payment when the checkout started. */
  providerRef: string | null;
  /** Our payment id, when the provider echoes our metadata back. */
  paymentId?: string | null;
  /** What the provider says was paid, when it reports it: checked against the payment. */
  amountMinor?: number;
  currency?: string;
};

export type CheckoutInput = {
  paymentId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  locale: AppLocale;
  /** Absolute URLs the payer returns to. They only *display* status; webhooks decide it. */
  successUrl: string;
  failureUrl: string;
  webhookUrl: string;
};

export class WebhookSignatureError extends Error {
  constructor(message = "invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

/**
 * A way for merchants to pay their subscription. Redirect providers send the payer to a hosted
 * checkout and confirm through a signed webhook; manual providers are confirmed by an admin.
 * New gateways implement this interface and register in `providers/index.ts`.
 */
export interface PaymentProvider {
  readonly id: "mock" | "manual" | "chargily";
  readonly kind: "redirect" | "manual";
  startCheckout?(input: CheckoutInput): Promise<{ redirectUrl: string; providerRef: string }>;
  /** Verifies the signature over the raw body and returns the normalised event, or throws. */
  parseWebhook?(rawBody: string, headers: Headers): Promise<ProviderWebhookEvent>;
}
