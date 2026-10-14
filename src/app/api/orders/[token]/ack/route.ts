import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/config/brand";
import { isSameOrigin } from "@/lib/http/request";
import { acknowledgeOrder } from "@/lib/orders/ring";

/** POST /api/orders/{token}/ack — "Got it, I'm coming". Idempotent; same-origin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request, appUrl())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  const { token } = await params;
  const result = await acknowledgeOrder(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "not_found" ? 404 : 409, headers },
    );
  }
  return NextResponse.json({ ok: true }, { headers });
}
