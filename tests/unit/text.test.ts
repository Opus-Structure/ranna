import { describe, expect, it } from "vitest";
import { cleanText } from "@/lib/validation/text";

describe("cleanText", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanText("  Café   El \t Bahdja  ")).toBe("Café El Bahdja");
  });
  it("strips control and bidi override characters", () => {
    expect(cleanText("Am\u0000ine‮")).toBe("Am ine");
    expect(cleanText("⁦101⁩")).toBe("101");
  });
  it("normalises to NFC so lengths are honest", () => {
    expect(cleanText("Café")).toBe("Café");
    expect(cleanText("Café")).toHaveLength(4);
  });
  it("keeps Arabic text intact", () => {
    expect(cleanText("  مقهى   البهجة ")).toBe("مقهى البهجة");
  });
  it("keeps single newlines in multiline mode and caps blank runs", () => {
    expect(cleanText("sans oignon\r\n\n\n\nbien cuit", { multiline: true })).toBe(
      "sans oignon\n\nbien cuit",
    );
  });
});
