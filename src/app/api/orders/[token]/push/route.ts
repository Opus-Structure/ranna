import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/config/brand";
import { serverEnv } from "@/lib/env";
import { clientIp, hashIdentifier, isSameOrigin } from "@/lib/http/request";
import { subscribePush } from "@/lib/orders/ring";
import { checkLimit } from "@/lib/rate-limit";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/orders/{token}/push — registers this browser's push subscription for the order.
 * Same-origin only (CSRF), rate-limited per IP, endpoints restricted to real push services.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isSameOrigin(request, appUrl())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }
  const ip = hashIdentifier(clientIp(request.headers), serverEnv().APP_SECRET);
  const limit = await checkLimit("pushSubscribe", ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSec) } },
    );
  }
  const body = await request.json().catch(() => null);
  const { token } = await params;
  const result = await subscribePush(token, body);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "invalid" ? 400 : 409;
    return NextResponse.json({ error: result.error }, { status, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
}
