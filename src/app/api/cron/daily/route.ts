import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { runDailyJobs } from "@/lib/jobs/daily";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Constant-time comparison of two secrets of any length (hashing equalises the lengths). */
function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * GET /api/cron/daily — run by Vercel Cron (vercel.json) with `Authorization: Bearer
 * $CRON_SECRET`. With no CRON_SECRET configured it refuses to run at all.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runDailyJobs();
  if (report.errors.length) console.error("daily jobs finished with errors", report.errors);
  return NextResponse.json(report, {
    status: report.errors.length ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
