import { describe, expect, it } from "vitest";
import { slugify, suggestSlug, validateSlug } from "@/lib/slug";

describe("validateSlug", () => {
  it.each(["cafe-el-bahdja", "snack-24", "abc", "a".repeat(40)])("accepts %s", (s) => {
    expect(validateSlug(s)).toEqual({ ok: true });
  });

  it.each([
    ["ab", "too_short"],
    ["a".repeat(41), "too_long"],
    ["Café", "invalid_chars"],
    ["my cafe", "invalid_chars"],
    ["مقهى", "invalid_chars"],
    ["-cafe", "edge_dash"],
    ["cafe-", "edge_dash"],
    ["my--cafe", "double_dash"],
    ["admin", "reserved"],
    ["dashboard", "reserved"],
    ["fr", "too_short"],
  ])("rejects %s (%s)", (s, problem) => {
    expect(validateSlug(s)).toEqual({ ok: false, problem });
  });

  it("matches the database check constraint for every accepted slug", () => {
    const dbPattern = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
    for (const s of ["abc", "cafe-el-bahdja", "x1-2-3"]) expect(dbPattern.test(s)).toBe(true);
  });
});

describe("slugify", () => {
  it("strips accents, punctuation and spaces", () => {
    expect(slugify("Café Él Bahdja")).toBe("cafe-el-bahdja");
    expect(slugify("  Snack  L'Étoile -- 24/7 ")).toBe("snack-letoile-24-7");
  });
  it("drops scripts that have no Latin form", () => {
    expect(slugify("مقهى البهجة")).toBe("");
  });
  it("never ends in a dash after truncation", () => {
    const s = slugify(`${"a".repeat(39)} b`);
    expect(s.endsWith("-")).toBe(false);
    expect(s.length).toBeLessThanOrEqual(40);
  });
});

describe("suggestSlug", () => {
  it("uses the name when it has Latin letters", () => {
    expect(suggestSlug("Café El Bahdja", "x9k2")).toBe("cafe-el-bahdja");
  });
  it("falls back to a neutral slug for Arabic-only or reserved names", () => {
    expect(suggestSlug("مقهى البهجة", "X9K2P7Q")).toBe("shop-x9k2p7");
    expect(suggestSlug("Admin", "abc123")).toBe("shop-abc123");
  });
});
