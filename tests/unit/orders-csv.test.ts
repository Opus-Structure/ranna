import { describe, expect, it } from "vitest";
import type { BoardOrder } from "@/lib/orders/board";
import { csvCell, ordersCsv, type CsvLabels } from "@/lib/orders/csv";

const labels: CsvLabels = {
  number: "No",
  placedAt: "At",
  status: "Status",
  customer: "Customer",
  table: "Table",
  items: "Items",
  total: "Total",
  cancelReason: "Reason",
  statuses: {
    new: "New",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Collected",
    canceled: "Canceled",
  },
};

const order = (over: Partial<BoardOrder> = {}): BoardOrder => ({
  id: "x",
  number: 101,
  status: "completed",
  customerName: "Amine",
  tableLabel: null,
  note: null,
  totalMinor: 45000,
  placedAt: "2026-10-14T08:51:00.000Z",
  statusAt: "2026-10-14T09:00:00.000Z",
  readyAt: null,
  acknowledgedAt: null,
  cancelReason: null,
  items: [{ name: "Wrap", quantity: 2, options: ["Maxi", "Harissa"], note: null }],
  ...over,
});

describe("csvCell", () => {
  it("quotes separators and quotes", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });

  it("defuses spreadsheet formulas typed by customers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+213")).toBe("'+213");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-1")).toBe("'-1");
    // Numbers are numbers, never prefixed.
    expect(csvCell(-1)).toBe("-1");
  });
});

describe("ordersCsv", () => {
  it("writes a BOM, a header and one row per order in the shop's time zone", () => {
    const csv = ordersCsv(
      [
        order(),
        order({ number: 102, status: "canceled", cancelReason: "Sold out", customerName: "=x" }),
      ],
      labels,
      {
        timeZone: "Africa/Algiers",
        exponent: 2,
      },
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("No,At,Status,Customer,Table,Items,Total,Reason");
    expect(lines[1]).toBe(
      '101,"14/10/2026, 09:51",Collected,Amine,,"2× Wrap (Maxi, Harissa)",450.00,',
    );
    expect(lines[2]).toContain("'=x");
    expect(lines[2]).toContain("Sold out");
  });

  it("respects the currency's minor units", () => {
    const csv = ordersCsv([order({ totalMinor: 1500 })], labels, { timeZone: "UTC", exponent: 0 });
    expect(csv).toContain(",1500,");
  });
});
