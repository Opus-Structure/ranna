import type { BoardOrder } from "./board";

const BOM = String.fromCharCode(0xfeff);

/**
 * A cell safe for spreadsheets: quoted when needed, and text that a spreadsheet would run as a
 * formula (= + - @, tab, carriage return) is prefixed with an apostrophe. Customer names and
 * notes are typed by the public, so this matters.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type CsvLabels = {
  number: string;
  placedAt: string;
  status: string;
  customer: string;
  table: string;
  items: string;
  total: string;
  cancelReason: string;
  statuses: Record<BoardOrder["status"], string>;
};

/**
 * One row per order. Money is in major units with a dot (machine-readable), times in the shop's
 * timezone. A UTF-8 BOM lets Excel open Arabic text correctly.
 */
export function ordersCsv(
  rows: BoardOrder[],
  labels: CsvLabels,
  opts: { timeZone: string; exponent: number },
): string {
  const per = 10 ** opts.exponent;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: opts.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const header = [
    labels.number,
    labels.placedAt,
    labels.status,
    labels.customer,
    labels.table,
    labels.items,
    labels.total,
    labels.cancelReason,
  ];
  const lines = rows.map((o) =>
    [
      o.number,
      time.format(new Date(o.placedAt)),
      labels.statuses[o.status],
      o.customerName,
      o.tableLabel,
      o.items
        .map(
          (i) => `${i.quantity}× ${i.name}${i.options.length ? ` (${i.options.join(", ")})` : ""}`,
        )
        .join("; "),
      (o.totalMinor / per).toFixed(opts.exponent),
      o.cancelReason,
    ]
      .map(csvCell)
      .join(","),
  );
  return `${BOM}${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
}
