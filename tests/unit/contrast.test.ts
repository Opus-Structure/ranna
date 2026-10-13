import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast, parseHex, readableOn, toHex } from "@/lib/color/contrast";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio(parseHex("#000")!, parseHex("#fff")!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseHex("#777")!, parseHex("#fff")!)).toBeCloseTo(4.48, 1);
  });
  it("picks white on dark brand colours and ink on light ones", () => {
    expect(toHex(readableOn(parseHex("#0b3d91")!).color)).toBe("#ffffff");
    expect(toHex(readableOn(parseHex("#ffd23f")!).color)).not.toBe("#ffffff");
  });
  it("derives an accessible variant of a pale brand colour", () => {
    const yellow = parseHex("#ffd23f")!;
    const white = parseHex("#ffffff")!;
    expect(contrastRatio(yellow, white)).toBeLessThan(4.5);
    expect(contrastRatio(ensureContrast(yellow, white, 4.5), white)).toBeGreaterThanOrEqual(4.5);
  });
  it("rejects malformed hex", () => {
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });
});
