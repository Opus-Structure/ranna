import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, oklchToRgb, type Rgb } from "@/lib/color/contrast";

/** Reads `--name: oklch(L C H)` tokens from a CSS block (light :root or .dark). */
function tokens(block: string): Record<string, Rgb> {
  const out: Record<string, Rgb> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)) {
    out[m[1]!] = oklchToRgb(Number(m[2]), Number(m[3]), Number(m[4]));
  }
  // Resolve simple var() aliases.
  for (const m of block.matchAll(/--([\w-]+):\s*var\(--([\w-]+)\)/g)) {
    if (out[m[2]!]) out[m[1]!] = out[m[2]!]!;
  }
  return out;
}

const css = readFileSync("src/app/globals.css", "utf8");
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf(".dark {")));
const dark = {
  ...light,
  ...tokens(css.slice(css.indexOf(".dark {"), css.indexOf("@theme inline"))),
};

const textPairs: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["clay-foreground", "clay"],
  ["clay-muted", "clay"],
  ["state-new-foreground", "state-new"],
  ["state-preparing-foreground", "state-preparing"],
  ["state-ready-foreground", "state-ready"],
  ["state-canceled-foreground", "state-canceled"],
  ["primary", "card"],
  ["destructive", "card"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s tokens", (_, t) => {
  it.each(textPairs)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("control borders meet 3:1 against cards", () => {
    expect(contrastRatio(t.input!, t.card!)).toBeGreaterThanOrEqual(3);
  });
});
