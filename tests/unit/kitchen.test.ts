import { describe, expect, it } from "vitest";
import {
  kitchenConfig,
  kitchenQueue,
  rememberId,
  routesToPrint,
  routesToScreen,
} from "../../src/lib/orders/kitchen";
import { orderingSettingsSchema } from "../../src/lib/validation/shop";

describe("kitchen routing", () => {
  it("defaults to none and 80 mm, and ignores junk", () => {
    expect(kitchenConfig({})).toEqual({ routing: "none", ticketWidthMm: 80 });
    expect(kitchenConfig({ kitchenRouting: "fax", ticketWidthMm: 12 })).toEqual({
      routing: "none",
      ticketWidthMm: 80,
    });
    expect(kitchenConfig({ kitchenRouting: "both", ticketWidthMm: 58 })).toEqual({
      routing: "both",
      ticketWidthMm: 58,
    });
  });

  it("maps modes to the print and screen switches", () => {
    expect(
      ["none", "print", "screen", "both"].map((m) => [
        m,
        routesToPrint(m as "none"),
        routesToScreen(m as "none"),
      ]),
    ).toEqual([
      ["none", false, false],
      ["print", true, false],
      ["screen", false, true],
      ["both", true, true],
    ]);
  });

  it("queues only what the kitchen cooks, oldest first", () => {
    const o = (id: string, status: string, placedAt: string) => ({ id, status, placedAt });
    const queue = kitchenQueue([
      o("c", "preparing", "2026-10-20T10:02:00Z"),
      o("r", "ready", "2026-10-20T10:00:00Z"),
      o("a", "new", "2026-10-20T10:01:00Z"),
      o("b", "accepted", "2026-10-20T10:03:00Z"),
    ]);
    expect(queue.map((x) => x.id)).toEqual(["a", "c", "b"]);
  });

  it("remembers printed ids without duplicates and within the cap", () => {
    expect(rememberId(["a"], "a")).toEqual(["a"]);
    expect(rememberId(["a", "b"], "c", 2)).toEqual(["b", "c"]);
  });

  it("accepts routing in the ordering settings and keeps older payloads valid", () => {
    const base = {
      prepTargetMinutes: 10,
      askPhone: true,
      phoneRetentionDays: 30,
      fallbackMessaging: false,
    };
    expect(orderingSettingsSchema.safeParse(base).success).toBe(true);
    expect(
      orderingSettingsSchema.safeParse({ ...base, kitchenRouting: "print", ticketWidthMm: 58 })
        .success,
    ).toBe(true);
    expect(orderingSettingsSchema.safeParse({ ...base, kitchenRouting: "x" }).success).toBe(false);
    expect(orderingSettingsSchema.safeParse({ ...base, ticketWidthMm: 70 }).success).toBe(false);
  });
});
