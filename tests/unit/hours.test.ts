import { describe, expect, it } from "vitest";
import { isWithinHours, localDayMinute, nextOpening } from "@/lib/shop/hours";

const tz = "Africa/Algiers"; // UTC+1, no DST
const week = (open: string, close: string, closedDays: number[] = []) =>
  Array.from({ length: 7 }, (_, day) => ({ day, open, close, closed: closedDays.includes(day) }));
// 2026-10-14 is a Wednesday (day 3).
const at = (localHHMM: string, date = "2026-10-14") => new Date(`${date}T${localHHMM}:00+01:00`);

describe("localDayMinute", () => {
  it("uses the shop time zone", () => {
    expect(localDayMinute(new Date("2026-10-13T23:30:00Z"), tz)).toEqual({ day: 3, minute: 30 });
  });
});

describe("isWithinHours", () => {
  it("treats missing hours as always open", () => {
    expect(isWithinHours(undefined, tz, at("03:00"))).toBe(true);
  });

  it("handles a normal day", () => {
    const h = week("08:00", "23:00");
    expect(isWithinHours(h, tz, at("07:59"))).toBe(false);
    expect(isWithinHours(h, tz, at("08:00"))).toBe(true);
    expect(isWithinHours(h, tz, at("22:59"))).toBe(true);
    expect(isWithinHours(h, tz, at("23:00"))).toBe(false);
  });

  it("handles hours past midnight, including the spill into the next day", () => {
    const h = week("18:00", "02:00");
    expect(isWithinHours(h, tz, at("17:59"))).toBe(false);
    expect(isWithinHours(h, tz, at("23:30"))).toBe(true);
    expect(isWithinHours(h, tz, at("01:30"))).toBe(true);
    expect(isWithinHours(h, tz, at("02:00"))).toBe(false);
  });

  it("respects closed days, including yesterday's overnight slot", () => {
    const closedTuesday = week("18:00", "02:00", [2]);
    // Wednesday 01:00 belongs to Tuesday's (closed) night.
    expect(isWithinHours(closedTuesday, tz, at("01:00"))).toBe(false);
    expect(isWithinHours(week("08:00", "23:00", [3]), tz, at("12:00"))).toBe(false);
  });
});

describe("nextOpening", () => {
  it("finds the next opening today or on a following day", () => {
    expect(nextOpening(week("08:00", "23:00"), tz, at("06:00"))).toEqual({
      day: 3,
      time: "08:00",
      today: true,
    });
    expect(nextOpening(week("08:00", "23:00", [4]), tz, at("23:30"))).toEqual({
      day: 5,
      time: "08:00",
      today: false,
    });
    expect(nextOpening(week("08:00", "23:00", [0, 1, 2, 3, 4, 5, 6]), tz, at("12:00"))).toBeNull();
  });
});
