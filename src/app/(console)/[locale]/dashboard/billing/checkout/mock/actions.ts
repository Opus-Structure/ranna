"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { appUrl } from "@/config/brand";
import { ownerAction } from "@/lib/auth/action-context";
import { getProvider } from "@/lib/billing/providers";
import {
  MOCK_SIGNATURE_HEADER,
  signMockWebhook,
  type MockWebhookBody,
} from "@/lib/billing/providers/mock";
import { serviceDb } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env";

/**
 * Plays the gateway: builds the provider's webhook, signs it, and POSTs it to our public
 * webhook endpoint, so the test exercises signature checks, idempotency and settlement.
 */
export async function completeMockCheckout(
  paymentId: string,
  outcome: "succeeded" | "failed",
): Promise<{ ok: boolean }> {
  const ctx = await ownerAction();
  if (!ctx || !getProvider("mock")) return { ok: false };
  const [payment] = await serviceDb
    .select({ providerRef: payments.providerRef, status: payments.status })
    .from(payments)
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.merchantId, ctx.merchant.id),
        eq(payments.provider, "mock"),
      ),
    );
  if (!payment?.providerRef || payment.status !== "pending") return { ok: false };

  const body: MockWebhookBody = {
    id: `evt_${randomUUID()}`,
    type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
    data: { providerRef: payment.providerRef, paymentId },
  };
  const raw = JSON.stringify(body);
  const res = await fetch(`${appUrl()}/api/webhooks/mock`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [MOCK_SIGNATURE_HEADER]: signMockWebhook(raw, serverEnv().APP_SECRET),
    },
    body: raw,
    cache: "no-store",
  });
  return { ok: res.ok };
}
