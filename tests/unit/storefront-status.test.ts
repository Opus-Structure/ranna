import { describe, expect, it } from "vitest";
import { storefrontStatus } from "@/lib/shop/status";

const hours = Array.from({ length: 7 }, (_, day) => ({
  day,
  open: "08:00",
  close: "23:00",
  closed: false,
}));
const noon = new Date("2026-10-14T12:00:00+01:00");
const base = {
  status: "active" as const,
  graceUntil: null,
  isOpen: true,
  acceptingOrders: true,
  openingHours: hours,
  timezone: "Africa/Algiers",
};

describe("storefrontStatus", () => {
  it("is open and orderable when everything lines up", () => {
    expect(storefrontStatus(base, noon)).toMatchObject({
      live: true,
      canOrder: true,
      tone: "open",
    });
  });

  it("pauses orders without closing the page", () => {
    expect(storefrontStatus({ ...base, acceptingOrders: false }, noon)).toMatchObject({
      live: true,
      canOrder: false,
      tone: "paused",
    });
  });

  it("is closed outside hours and says when it reopens", () => {
    const night = new Date("2026-10-14T23:30:00+01:00");
    expect(storefrontStatus(base, night)).toMatchObject({
      canOrder: false,
      tone: "closed",
      reason: "outside_hours",
      next: { day: 4, time: "08:00", today: false },
    });
  });

  it("honours the manual closed switch", () => {
    expect(storefrontStatus({ ...base, isOpen: false }, noon)).toMatchObject({
      canOrder: false,
      reason: "closed_toggle",
    });
  });

  it("is not live for unpaid accounts, and live during the grace period", () => {
    expect(storefrontStatus({ ...base, status: "suspended" }, noon).live).toBe(false);
    expect(storefrontStatus({ ...base, status: "pending_payment" }, noon).live).toBe(false);
    const grace = storefrontStatus(
      { ...base, status: "past_due", graceUntil: "2026-10-16T00:00:00Z" },
      noon,
    );
    expect(grace).toMatchObject({ live: true, canOrder: true });
  });
});
