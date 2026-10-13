import { describe, expect, it } from "vitest";
import { formatMoney, toMajor, toMinor } from "@/lib/money";
import { businessDate, minutesBetween } from "@/lib/time";

describe("businessDate", () => {
  it("uses the shop's time zone, not UTC", () => {
    // 23:30 UTC on Oct 13 is 00:30 on Oct 14 in Algiers (UTC+1).
    const at = new Date("2026-10-13T23:30:00Z");
    expect(businessDate(at, "Africa/Algiers")).toBe("2026-10-14");
    expect(businessDate(at, "UTC")).toBe("2026-10-13");
  });
});

describe("minutesBetween", () => {
  it("floors and never goes negative", () => {
    const a = new Date("2026-10-13T10:00:00Z");
    expect(minutesBetween(a, new Date("2026-10-13T10:07:59Z"))).toBe(7);
    expect(minutesBetween(a, new Date("2026-10-13T09:00:00Z"))).toBe(0);
  });
});

describe("money", () => {
  it("converts between major and minor units", () => {
    expect(toMinor(350, "DZD")).toBe(35000);
    expect(toMajor(35000, "DZD")).toBe(350);
    expect(toMinor(1.005, "TND")).toBe(1005);
  });
  it("shows DZD without decimals, with Western digits in Arabic", () => {
    const ar = formatMoney(125000, "DZD", "ar");
    expect(ar).toMatch(/1[.,٬  ]?250/);
    expect(ar).not.toMatch(/[٠-٩]/);
    expect(formatMoney(125000, "DZD", "fr")).not.toMatch(/,00/);
    expect(formatMoney(125050, "EUR", "en")).toContain("1,250.50");
  });
});
