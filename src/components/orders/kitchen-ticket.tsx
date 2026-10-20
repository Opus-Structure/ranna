"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BoardOrder } from "@/lib/orders/board";
import type { TicketWidth } from "@/lib/orders/kitchen";

/**
 * The kitchen ticket: a narrow receipt (58 or 80 mm) that only exists on paper. It is rendered
 * into the page's body, hidden on screen, and the print stylesheet hides everything else, so
 * `window.print()` produces exactly this slip. No prices: the kitchen needs what to make.
 */
function KitchenTicket({
  order,
  shopName,
  timeZone,
  widthMm,
}: {
  order: BoardOrder;
  shopName: string;
  timeZone: string;
  widthMm: TicketWidth;
}) {
  const t = useTranslations("orders.kitchen.ticket");
  const format = useFormatter();
  const placed = new Date(order.placedAt);
  const inner = widthMm - 6;
  const small = widthMm === 58;
  const css = `
.kt-root{display:none}
@media print{
  @page{size:${widthMm}mm auto;margin:0}
  html,body{background:#fff!important;margin:0!important;padding:0!important}
  body>*:not(.kt-root){display:none!important}
  .kt-root{display:block;box-sizing:border-box;width:${widthMm}mm;padding:3mm;color:#000;background:#fff;
    font-family:Cairo,ui-sans-serif,system-ui,sans-serif;font-size:${small ? 3.6 : 4.1}mm;line-height:1.3}
  .kt-root *{color:#000!important;background:transparent!important;box-shadow:none!important}
  .kt-center{text-align:center}
  .kt-shop{font-size:${small ? 3.2 : 3.6}mm;font-weight:600}
  .kt-kind{font-size:${small ? 3.2 : 3.6}mm;font-weight:700;letter-spacing:0;margin-top:1mm}
  .kt-number{font-size:${small ? 17 : 22}mm;font-weight:800;line-height:1;margin:2mm 0;font-variant-numeric:tabular-nums}
  .kt-meta{display:flex;justify-content:space-between;gap:2mm;font-weight:600}
  .kt-rule{border:0;border-top:0.5mm dashed #000;margin:2.5mm 0;width:${inner}mm}
  .kt-items{list-style:none;margin:0;padding:0}
  .kt-item{margin:0 0 2.5mm;break-inside:avoid}
  .kt-name{font-weight:700;font-size:${small ? 4.2 : 4.8}mm}
  .kt-sub{display:block;padding-inline-start:5mm}
  .kt-note{display:block;padding-inline-start:5mm;font-style:italic}
  .kt-order-note{border:0.4mm solid #000;padding:1.5mm;margin-top:1mm;font-weight:600;break-inside:avoid}
  .kt-end{height:8mm}
}`;
  return (
    <div className="kt-root" aria-hidden>
      <style>{css}</style>
      <div className="kt-center">
        <div className="kt-shop">
          <bdi>{shopName}</bdi>
        </div>
        <div className="kt-kind">{t("kitchen")}</div>
        <div className="kt-number" data-numeric>
          {order.number}
        </div>
      </div>
      <div className="kt-meta">
        <span>
          {format.dateTime(placed, { hour: "2-digit", minute: "2-digit", timeZone })}
          {" · "}
          {format.dateTime(placed, { day: "2-digit", month: "2-digit", timeZone })}
        </span>
        {order.tableLabel ? (
          <span>
            {t("table")} <bdi>{order.tableLabel}</bdi>
          </span>
        ) : null}
      </div>
      <div>
        <bdi>{order.customerName}</bdi>
      </div>
      <hr className="kt-rule" />
      <ul className="kt-items">
        {order.items.map((item, i) => (
          <li key={i} className="kt-item">
            <span className="kt-name">
              {item.quantity}× <bdi>{item.name}</bdi>
            </span>
            {item.options.length ? (
              <span className="kt-sub">{item.options.join(" · ")}</span>
            ) : null}
            {item.note ? <span className="kt-note">“{item.note}”</span> : null}
          </li>
        ))}
      </ul>
      {order.note ? (
        <div className="kt-order-note">
          {t("note")}: {order.note}
        </div>
      ) : null}
      <hr className="kt-rule" />
      <div className="kt-center kt-shop">{t("items", { count: order.items.length })}</div>
      <div className="kt-end" />
    </div>
  );
}

/**
 * Prints kitchen tickets one after the other. `print(order)` queues a ticket; the element to
 * render once in the page holds the slip being printed. Printing is blocking in some browsers
 * and asynchronous in others, so the next ticket waits for `afterprint` (or 20 s at most).
 */
export function useTicketPrinter({
  shopName,
  timeZone,
  widthMm,
}: {
  shopName: string;
  timeZone: string;
  widthMm: TicketWidth;
}) {
  const [queue, setQueue] = useState<BoardOrder[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = queue[0];
  const currentId = current?.id;

  const print = useCallback((order: BoardOrder) => {
    setQueue((q) => [...q, order]);
  }, []);

  useEffect(() => {
    if (!currentId) return;
    let done = false;
    let fallback: number | undefined;
    const next = () => {
      if (done) return;
      done = true;
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", next);
      setQueue((q) => q.slice(1));
    };
    // Let the slip render before the browser snapshots the page for printing.
    const start = window.setTimeout(() => {
      window.addEventListener("afterprint", next);
      fallback = window.setTimeout(next, 20_000);
      try {
        window.print();
      } catch {
        next();
      }
    }, 80);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", next);
    };
  }, [currentId]);

  const element =
    mounted && current
      ? createPortal(
          <KitchenTicket
            order={current}
            shopName={shopName}
            timeZone={timeZone}
            widthMm={widthMm}
          />,
          document.body,
        )
      : null;

  return { print, element, printing: Boolean(current) };
}
