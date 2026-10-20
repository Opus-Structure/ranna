import { NextResponse } from "next/server";
import { memberAction } from "@/lib/auth/action-context";
import { sealBoardPulse } from "@/lib/realtime/live";

/**
 * POST /api/orders/live: a sealed live query over the signed-in member's own shop, so the board
 * learns about changes the moment they happen. A Route Handler (not a Server Action) because
 * actions run one at a time and the sealed query is renewed every minute.
 */
export async function POST() {
  const headers = { "Cache-Control": "no-store" };
  const ctx = await memberAction();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const sealed = await sealBoardPulse(ctx.merchant.id).catch(() => null);
  if (!sealed) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  return NextResponse.json(sealed, { headers });
}
