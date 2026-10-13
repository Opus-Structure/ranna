import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function placeholders(text: string): string[] {
  // Top-level ICU arguments only ({name} or {name, plural, ...}).
  return [...text.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]!).sort();
}

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

describe("message catalogs", () => {
  const base = keys(en).sort();
  it.each([
    ["ar", ar],
    ["fr", fr],
  ])("%s has exactly the English keys", (_, catalog) => {
    expect(keys(catalog).sort()).toEqual(base);
  });

  it.each([
    ["ar", ar],
    ["fr", fr],
  ])("%s uses the same placeholders", (_, catalog) => {
    for (const key of base) {
      const a = get(en, key);
      const b = get(catalog, key);
      if (typeof a === "string" && typeof b === "string") {
        expect([key, [...new Set(placeholders(b))]]).toEqual([key, [...new Set(placeholders(a))]]);
      }
    }
  });
});
