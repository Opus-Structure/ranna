import { describe, expect, it } from "vitest";
import { pickOptional, pickText, searchKey } from "@/lib/i18n/pick";

describe("pickText", () => {
  it("prefers the visitor's language and falls back to the base", () => {
    expect(pickText("Café", { ar: "قهوة" }, "ar")).toBe("قهوة");
    expect(pickText("Café", { ar: "قهوة" }, "fr")).toBe("Café");
    expect(pickText("Café", { fr: "  " }, "fr")).toBe("Café");
    expect(pickOptional(null, {}, "en")).toBeNull();
  });
});

describe("searchKey", () => {
  it("ignores Latin accents and case", () => {
    expect(searchKey("Café Crème")).toBe("cafe creme");
  });
  it("ignores Arabic diacritics, tatweel and letter variants", () => {
    expect(searchKey("قَهْوَة")).toBe(searchKey("قهوه"));
    expect(searchKey("أطباق")).toBe(searchKey("اطباق"));
    expect(searchKey("حلـــوى")).toBe(searchKey("حلوي"));
  });
});
