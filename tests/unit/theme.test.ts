import { describe, expect, it } from "vitest";
import { shopTheme, SHOP_GROUND } from "@/lib/branding/theme";
import { contrastRatio, parseHex } from "@/lib/color/contrast";

const ratio = (a: string, b: string) => contrastRatio(parseHex(a)!, parseHex(b)!);

describe("shopTheme", () => {
  it("falls back to defaults for missing or malformed values", () => {
    const t = shopTheme({ primaryColor: "red", font: "comic-sans" as never });
    expect(t.vars["--brand"]).toBe("#b14420");
    expect(t.font).toBe("cairo");
    expect(t.layout).toBe("list");
  });

  it("always yields readable text on brand fills and brand text on the ground", () => {
    for (const hex of [
      "#ffd23f",
      "#0b3d91",
      "#e6e6e6",
      "#1a1a1a",
      "#00a86b",
      "#ff6f61",
      "#7a7a7a",
    ]) {
      const t = shopTheme({ primaryColor: hex, secondaryColor: hex });
      expect(ratio(t.vars["--brand-ink"]!, SHOP_GROUND)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.vars["--brand-2-ink"]!, SHOP_GROUND)).toBeGreaterThanOrEqual(4.5);
      // Readable-on picks the better of white/ink; warnings cover the rare mid-grey case.
      const onBrand = ratio(t.vars["--brand-contrast"]!, t.vars["--brand"]!);
      if (onBrand < 4.5)
        expect(t.warnings).toContainEqual(
          expect.objectContaining({ kind: "button_text", color: "primary" }),
        );
    }
  });

  it("warns when a pale brand colour disappears on the page", () => {
    const t = shopTheme({ primaryColor: "#ffe9a8" });
    expect(t.warnings).toContainEqual(
      expect.objectContaining({ kind: "on_ground", color: "primary" }),
    );
    expect(t.vars["--brand-contrast"]).not.toBe("#ffffff");
  });

  it("gives dark brands white button text and no warnings", () => {
    const t = shopTheme({ primaryColor: "#0b3d91", secondaryColor: "#5a1e0f" });
    expect(t.vars["--brand-contrast"]).toBe("#ffffff");
    expect(t.warnings).toEqual([]);
  });
});
