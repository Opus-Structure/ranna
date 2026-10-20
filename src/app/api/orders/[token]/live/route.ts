import { NextResponse } from "next/server";
import { hashToken, TOKEN_PATTERN } from "@/lib/orders/token";
import { sealOrderPulse } from "@/lib/realtime/live";

/**
 * POST /api/orders/{token}/live: hands the customer's page a sealed live query for exactly its
 * own order. The token is the credential; the query is bound to its hash, so the capability
 * reveals nothing else. 503 means Realtime is off and the page keeps polling.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!TOKEN_PATTERN.test(token))
    return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const sealed = await sealOrderPulse(hashToken(token)).catch(() => null);
  if (!sealed) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  return NextResponse.json(sealed, { headers });
}
