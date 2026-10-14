import { NextResponse, type NextRequest } from "next/server";
import { translatorFor } from "@/lib/i18n/translator";
import { getMerchantContext } from "@/lib/merchants/context";
import { currencyExponent } from "@/lib/money";
import { HISTORY_LIMIT, loadHistory } from "@/lib/orders/board";
import { ordersCsv } from "@/lib/orders/csv";
import { ORDER_STATUSES } from "@/lib/orders/transitions";

/**
 * GET /api/orders/export?date=YYYY-MM-DD&locale=fr: one business day of orders as CSV.
 * Owner only: the file carries customer names. Phone numbers are never exported.
 */
export async function GET(request: NextRequest) {
  const ctx = await getMerchantContext();
  if (!ctx || ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? undefined;
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const history = await loadHistory(ctx, { date, status: "all", q: "" });
  const { t } = translatorFor(params.get("locale"));
  const csv = ordersCsv(
    history.orders,
    {
      number: t("orders.csv.number"),
      placedAt: t("orders.csv.placedAt"),
      status: t("orders.csv.status"),
      customer: t("orders.csv.customer"),
      table: t("orders.csv.table"),
      items: t("orders.csv.items"),
      total: t("orders.csv.total", { currency: ctx.merchant.currency }),
      cancelReason: t("orders.csv.cancelReason"),
      statuses: Object.fromEntries(
        ORDER_STATUSES.map((s) => [s, t(`orders.status.${s}`)]),
      ) as Record<(typeof ORDER_STATUSES)[number], string>,
    },
    { timeZone: ctx.merchant.timezone, exponent: currencyExponent(ctx.merchant.currency) },
  );
  const name = `orders-${ctx.merchant.slug ?? "shop"}-${history.date}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      ...(history.orders.length >= HISTORY_LIMIT ? { "X-Truncated": "true" } : {}),
    },
  });
}
