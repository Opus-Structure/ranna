import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath, qrSvg, shopUrl, TABLE_CODE } from "@/lib/qr/matrix";

describe("shopUrl", () => {
  it("points at the shop page, with the table code when given", () => {
    expect(shopUrl("https://ranna.app/", "cafe-el-bahdja")).toBe(
      "https://ranna.app/s/cafe-el-bahdja",
    );
    expect(shopUrl("https://ranna.app", "demo", "T5")).toBe("https://ranna.app/s/demo?t=T5");
  });
});

describe("TABLE_CODE", () => {
  it("accepts short plain codes only", () => {
    for (const ok of ["5", "T12", "terrasse-3", "bar_1"]) expect(TABLE_CODE.test(ok)).toBe(true);
    for (const bad of ["", "a b", "<script>", "x".repeat(13), "طاولة"])
      expect(TABLE_CODE.test(bad)).toBe(false);
  });
});

describe("qr rendering", () => {
  const text = "https://ranna.app/s/demo?t=5";

  it("matches the library's module matrix exactly", () => {
    const ours = qrMatrix(text);
    const ref = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
    expect(ours.size).toBe(ref.size);
    for (let y = 0; y < ref.size; y++) {
      for (let x = 0; x < ref.size; x++)
        expect(ours.dark(x, y)).toBe(ref.data[y * ref.size + x] === 1);
    }
  });

  it("draws every dark module once inside a quiet zone", () => {
    const m = qrMatrix(text);
    const { d, viewBox } = qrPath(m, 4);
    expect(viewBox).toBe(m.size + 8);
    let dark = 0;
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.dark(x, y)) dark++;
    const covered = [...d.matchAll(/h(\d+)v1/g)].reduce((s, r) => s + Number(r[1]), 0);
    expect(covered).toBe(dark);
    expect(d).not.toMatch(/M[0-3] /); // nothing drawn inside the left quiet zone
  });

  it("produces a standalone SVG with the requested colours", () => {
    const svg = qrSvg(text, { dark: "#0f5e63", light: "#ffffff" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#0f5e63"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
});
