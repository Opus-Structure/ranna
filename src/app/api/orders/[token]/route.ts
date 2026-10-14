import { NextResponse } from "next/server";
import { loadCustomerOrderStatus } from "@/lib/orders/service";

/**
 * GET /api/orders/{token}: the customer page's polling fallback for when the realtime socket
 * drops. The 128-bit token is the only credential; responses are never cached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const status = await loadCustomerOrderStatus(token);
  if (!status)
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
