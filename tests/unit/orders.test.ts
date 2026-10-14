import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { priceOrder, type CartLine } from "@/lib/orders/pricing";
import { hashToken, orderTokenFor, orderTopic, TOKEN_PATTERN } from "@/lib/orders/token";
import {
  canTransition,
  customerStage,
  ORDER_STATUSES,
  timestampFor,
} from "@/lib/orders/transitions";
import type { PublicCategory } from "@/lib/shop/public";

const opt = (id: string, delta = 0, isAvailable = true) => ({
  id,
  name: id,
  nameI18n: {},
  priceDeltaMinor: delta,
  isAvailable,
});

const menu: PublicCategory[] = [
  {
    id: "c1",
    name: "Sandwiches",
    nameI18n: {},
    items: [
      {
        id: "shawarma",
        name: "شاورما",
        nameI18n: { fr: "Chawarma" },
        description: null,
        descriptionI18n: {},
        priceMinor: 45000,
        imagePath: null,
        isAvailable: true,
        optionGroups: [
          {
            id: "size",
            name: "Size",
            nameI18n: {},
            minSelect: 1,
            maxSelect: 1,
            options: [opt("regular"), opt("maxi", 15000)],
          },
          {
            id: "sauce",
            name: "Sauce",
            nameI18n: {},
            minSelect: 0,
            maxSelect: 2,
            options: [opt("harissa"), opt("mayo"), opt("cheese", 5000, false)],
          },
        ],
      },
      {
        id: "tea",
        name: "Tea",
        nameI18n: {},
        description: null,
        descriptionI18n: {},
        priceMinor: 10000,
        imagePath: null,
        isAvailable: true,
        optionGroups: [],
      },
      {
        id: "zlabia",
        name: "Zlabia",
        nameI18n: {},
        description: null,
        descriptionI18n: {},
        priceMinor: 5000,
        imagePath: null,
        isAvailable: false,
        optionGroups: [],
      },
    ],
  },
];

const line = (itemId: string, quantity = 1, optionIds: string[] = [], note?: string): CartLine => ({
  itemId,
  quantity,
  optionIds,
  note,
});

describe("priceOrder", () => {
  it("prices from the menu, adds option deltas and snapshots names", () => {
    const r = priceOrder(menu, [
      line("shawarma", 2, ["maxi", "harissa"], " sans oignon "),
      line("tea", 3),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toMatchObject({
      name: "شاورما",
      unitPriceMinor: 60000,
      quantity: 2,
      lineTotalMinor: 120000,
      note: "sans oignon",
      options: [
        { groupName: "Size", optionName: "maxi", priceDeltaMinor: 15000 },
        { groupName: "Sauce", optionName: "harissa", priceDeltaMinor: 0 },
      ],
    });
    expect(r.subtotalMinor).toBe(150000);
    expect(r.totalMinor).toBe(150000);
  });

  it.each([
    [[], "empty"],
    [[line("tea", 0)], "quantity"],
    [[line("tea", 51)], "quantity"],
    [[line("tea", 1.5)], "quantity"],
    [[line("zlabia")], "item_unavailable"],
    [[line("ghost")], "item_unavailable"],
    [[line("shawarma", 1, [])], "option_required"],
    [[line("shawarma", 1, ["regular", "maxi"])], "too_many_options"],
    [[line("shawarma", 1, ["regular", "harissa", "mayo", "cheese"])], "too_many_options"],
    [[line("shawarma", 1, ["regular", "cheese"])], "option_unavailable"],
    [[line("shawarma", 1, ["regular", "regular"])], "option_invalid"],
    [[line("tea", 1, ["maxi"])], "option_invalid"],
    [[line("shawarma", 1, ["regular", "not-an-option"])], "option_invalid"],
  ] as const)("rejects %j with %s", (cart, error) => {
    expect(priceOrder(menu, [...cart] as CartLine[])).toMatchObject({ ok: false, error });
  });

  it("caps the number of lines", () => {
    const many = Array.from({ length: 31 }, () => line("tea"));
    expect(priceOrder(menu, many)).toMatchObject({ ok: false, error: "too_many_lines" });
  });

  it("ignores any price the client might try to send", () => {
    const forged = [{ ...line("tea"), unitPriceMinor: 1, priceMinor: 1 } as CartLine];
    const r = priceOrder(menu, forged);
    expect(r.ok && r.totalMinor).toBe(10000);
  });
});

describe("order tokens", () => {
  const secret = "s".repeat(40);
  it("are 128-bit base64url, stable per request id and unpredictable without the secret", () => {
    const a = orderTokenFor(secret, "m1", "req-1");
    expect(a).toMatch(TOKEN_PATTERN);
    expect(Buffer.from(a, "base64url")).toHaveLength(16);
    expect(orderTokenFor(secret, "m1", "req-1")).toBe(a);
    expect(orderTokenFor(secret, "m1", "req-2")).not.toBe(a);
    expect(orderTokenFor(secret, "m2", "req-1")).not.toBe(a);
    expect(orderTokenFor("t".repeat(40), "m1", "req-1")).not.toBe(a);
  });

  it("store only a SHA-256 and derive the realtime topic from it", () => {
    const token = orderTokenFor(secret, "m1", "req-1");
    const hash = hashToken(token);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).not.toContain(token);
    expect(orderTopic(hash)).toBe(`order:${hash.slice(0, 32)}`);
  });
});

describe("order transitions", () => {
  it("only move forward, except undoing Ready", () => {
    expect(canTransition("new", "accepted")).toBe(true);
    expect(canTransition("new", "ready")).toBe(true);
    expect(canTransition("preparing", "ready")).toBe(true);
    expect(canTransition("ready", "completed")).toBe(true);
    expect(canTransition("ready", "preparing")).toBe(true);
    expect(canTransition("preparing", "new")).toBe(false);
    expect(canTransition("preparing", "accepted")).toBe(false);
    expect(canTransition("new", "completed")).toBe(false);
    for (const to of ORDER_STATUSES) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("canceled", to)).toBe(false);
    }
  });

  it("stamp the right column and map to customer stages", () => {
    expect(timestampFor("ready")).toBe("readyAt");
    expect(timestampFor("new")).toBeNull();
    expect(customerStage("new")).toBe("received");
    expect(customerStage("accepted")).toBe("received");
    expect(customerStage("preparing")).toBe("preparing");
    expect(customerStage("ready")).toBe("ready");
    expect(customerStage("completed")).toBe("collected");
    expect(customerStage("canceled")).toBe("canceled");
  });
});
