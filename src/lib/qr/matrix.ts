import QRCode from "qrcode";

/** Table/counter codes: what follows `?t=` and is shown to staff on the order. */
export const TABLE_CODE = /^[A-Za-z0-9_-]{1,12}$/;

/** The address a QR code opens: the shop page, plus the table code when there is one. */
export function shopUrl(origin: string, slug: string, tableCode?: string | null): string {
  const base = `${origin.replace(/\/$/, "")}/s/${slug}`;
  return tableCode ? `${base}?t=${encodeURIComponent(tableCode)}` : base;
}

export type QrMatrix = { size: number; dark: (x: number, y: number) => boolean };

/**
 * Module matrix for `text`. Error correction "M" (15%) survives a crumpled table tent while
 * keeping modules large; short shop URLs fit in a small version.
 */
export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const { size, data } = qr.modules;
  return { size, dark: (x, y) => data[y * size + x] === 1 };
}

/**
 * Compact SVG path for the dark modules: one rectangle run per horizontal stretch. `margin` is
 * the quiet zone in modules (4 is the standard minimum for reliable scanning).
 */
export function qrPath(matrix: QrMatrix, margin = 4): { d: string; viewBox: number } {
  const parts: string[] = [];
  for (let y = 0; y < matrix.size; y++) {
    let x = 0;
    while (x < matrix.size) {
      if (!matrix.dark(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < matrix.size && matrix.dark(x, y)) x++;
      parts.push(`M${start + margin} ${y + margin}h${x - start}v1h-${x - start}z`);
    }
  }
  return { d: parts.join(""), viewBox: matrix.size + margin * 2 };
}

export function qrSvg(
  text: string,
  { dark = "#000000", light = "#ffffff", margin = 4 } = {},
): string {
  const { d, viewBox } = qrPath(qrMatrix(text), margin);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}" shape-rendering="crispEdges">`,
    `<rect width="${viewBox}" height="${viewBox}" fill="${light}"/>`,
    `<path d="${d}" fill="${dark}"/>`,
    `</svg>`,
  ].join("");
}
