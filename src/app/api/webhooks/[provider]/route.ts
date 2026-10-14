import { NextResponse, type NextRequest } from "next/server";
import { handleProviderWebhook } from "@/lib/billing/webhooks";

/**
 * Payment provider webhooks: POST /api/webhooks/{chargily|mock}.
 * Authenticated by the provider's signature over the raw body (no cookies, no CSRF surface).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const rawBody = await request.text();
  if (rawBody.length > 64 * 1024) return NextResponse.json({ received: false }, { status: 413 });
  const outcome = await handleProviderWebhook(provider, rawBody, request.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
