import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { appUrl } from "@/config/brand";
import { getMerchantContext } from "@/lib/merchants/context";
import { qrSvg, shopUrl, TABLE_CODE } from "@/lib/qr/matrix";

/**
 * GET /api/qr?format=svg|png[&t=<table code>] — the signed-in owner's shop QR as a download.
 * PNG is 2048 px with a 4-module quiet zone: sharp on an A3 poster.
 */
export async function GET(request: NextRequest) {
  const ctx = await getMerchantContext();
  if (!ctx || ctx.role !== "owner")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!ctx.merchant.slug) return NextResponse.json({ error: "slug_required" }, { status: 409 });

  const params = request.nextUrl.searchParams;
  const format = params.get("format") === "png" ? "png" : "svg";
  const table = params.get("t");
  if (table !== null && !TABLE_CODE.test(table))
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const url = shopUrl(appUrl(), ctx.merchant.slug, table);
  const name = `qr-${ctx.merchant.slug}${table ? `-${table}` : ""}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, no-store",
  };

  if (format === "svg") {
    return new NextResponse(qrSvg(url), {
      headers: { ...headers, "Content-Type": "image/svg+xml" },
    });
  }
  const png = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    width: 2048,
    margin: 4,
  });
  return new NextResponse(new Uint8Array(png), {
    headers: { ...headers, "Content-Type": "image/png" },
  });
}
