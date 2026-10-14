import "server-only";
import { and, eq } from "drizzle-orm";
import { serviceDb } from "@/lib/db/client";
import { payments, webhookEvents } from "@/lib/db/schema";
import { dispatchAccountEffects } from "./notify";
import { failPayment, settlePayment } from "./payments";
import { getProvider } from "./providers";
import { WebhookSignatureError } from "./providers/types";

export type WebhookOutcome = {
  status: number;
  body: { received: boolean; duplicate?: boolean; error?: string };
};

/**
 * Generic, idempotent webhook pipeline for every redirect provider:
 * verify signature → record event id once → find our payment → settle or fail → mark processed.
 * Retries of an already processed event return 200 without side effects.
 */
export async function handleProviderWebhook(
  providerId: string,
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const provider = getProvider(providerId);
  if (!provider?.parseWebhook)
    return { status: 404, body: { received: false, error: "unknown_provider" } };

  let event;
  try {
    event = await provider.parseWebhook(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError || err instanceof SyntaxError) {
      return { status: 400, body: { received: false, error: "invalid_signature" } };
    }
    throw err;
  }

  const [inserted] = await serviceDb
    .insert(webhookEvents)
    .values({ provider: provider.id, eventId: event.eventId, eventType: event.type })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!inserted) {
    const [prior] = await serviceDb
      .select({ processedAt: webhookEvents.processedAt })
      .from(webhookEvents)
      .where(
        and(eq(webhookEvents.provider, provider.id), eq(webhookEvents.eventId, event.eventId)),
      );
    // Processed before: acknowledge. Received but not processed (crash mid-way): process again;
    // settlement itself is idempotent.
    if (prior?.processedAt) return { status: 200, body: { received: true, duplicate: true } };
  }

  const markProcessed = (error?: string) =>
    serviceDb
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: error ?? null })
      .where(
        and(eq(webhookEvents.provider, provider.id), eq(webhookEvents.eventId, event.eventId)),
      );

  if (event.type === "ignored") {
    await markProcessed();
    return { status: 200, body: { received: true } };
  }

  const [payment] = event.providerRef
    ? await serviceDb
        .select({ id: payments.id, amountMinor: payments.amountMinor, currency: payments.currency })
        .from(payments)
        .where(and(eq(payments.provider, provider.id), eq(payments.providerRef, event.providerRef)))
    : [];
  if (!payment || (event.paymentId && event.paymentId !== payment.id)) {
    // Acknowledge so the provider stops retrying; the ledger keeps the reason for support.
    await markProcessed("unknown_payment");
    return { status: 200, body: { received: true, error: "unknown_payment" } };
  }
  // A "paid" event for another amount or currency never activates a plan: an admin reviews it.
  const amountMismatch =
    (event.amountMinor !== undefined && event.amountMinor !== payment.amountMinor) ||
    (event.currency !== undefined && event.currency !== payment.currency.toUpperCase());
  if (event.type === "payment.succeeded" && amountMismatch) {
    await markProcessed("amount_mismatch");
    console.error("webhook amount mismatch", { provider: provider.id, eventId: event.eventId });
    return { status: 200, body: { received: true, error: "amount_mismatch" } };
  }

  try {
    if (event.type === "payment.succeeded") {
      const result = await settlePayment(
        payment.id,
        { type: "webhook" },
        event.providerRef ?? undefined,
      );
      if (result.ok && result.applied?.ok) {
        await dispatchAccountEffects(result.applied.merchantId, result.applied.effects);
      }
    } else {
      await failPayment(payment.id, "failed", { type: "webhook" });
    }
    await markProcessed();
    return { status: 200, body: { received: true } };
  } catch (err) {
    await serviceDb
      .update(webhookEvents)
      .set({ error: err instanceof Error ? err.message.slice(0, 300) : "processing_failed" })
      .where(
        and(eq(webhookEvents.provider, provider.id), eq(webhookEvents.eventId, event.eventId)),
      );
    console.error("webhook processing failed", { provider: provider.id, eventId: event.eventId });
    // 500 makes the provider retry later; the ledger row lets the retry resume.
    return { status: 500, body: { received: false, error: "processing_failed" } };
  }
}
