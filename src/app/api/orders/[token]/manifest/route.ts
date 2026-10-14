import { NextResponse } from "next/server";
import { brand } from "@/config/brand";
import { localizedPath } from "@/lib/auth/paths";
import { isAppLocale } from "@/i18n/routing";
import { loadCustomerOrder } from "@/lib/orders/service";

/**
 * GET /api/orders/{token}/manifest — a web app manifest for one order. On iPhone, web push only
 * works for sites added to the Home Screen, and the Home Screen app opens `start_url`: so the
 * manifest points at this order's page, and the installed app opens straight onto it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await loadCustomerOrder(token);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale");
  const path = localizedPath(`/o/${token}`, isAppLocale(locale) ? locale : "ar");
  const manifest = {
    name: `${order.number} · ${order.shop.name}`,
    short_name: `${order.number} · ${brand.name}`,
    id: path,
    start_url: path,
    scope: "/",
    display: "standalone",
    background_color: "#f6efe6",
    theme_color: order.shop.branding.primaryColor ?? "#76291d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
