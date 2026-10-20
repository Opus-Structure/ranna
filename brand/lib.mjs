import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";

/** oklch -> sRGB hex, so the palette is literally the DESIGN.md tokens. */
export function oklch(L, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
  return "#" + lin.map((v) => { v = Math.min(1, Math.max(0, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(v * 255).toString(16).padStart(2, "0"); }).join("").toUpperCase();
}
/** Brand palette = DESIGN.md tokens (red-ochre, fired-clay, clay-slip, slip-white, manganese-ink, hairline). */
export const C = {
  ochre: oklch(0.53, 0.15, 38),
  clay: oklch(0.38, 0.105, 30),
  slip: oklch(0.965, 0.012, 70),
  paper: oklch(0.992, 0.003, 75),
  ink: oklch(0.235, 0.018, 40),
  hairline: oklch(0.885, 0.012, 60),
};

const fdir = "node_modules/@fontsource/alexandria/files/";
export const latin = opentype.loadSync(fdir + "alexandria-latin-700-normal.woff");
export const arabic = opentype.loadSync(fdir + "alexandria-arabic-700-normal.woff");

/** Mark geometry on the 200-unit grid (all Y shifted by -4 so the mark sits on the grid centre). */
export const G = {
  dome: "M36 136C36 136 44 128 48 112C52 84 72 66 100 66C128 66 148 84 152 112C156 128 164 136 164 136Z",
  arcsL: ["M36 64C28 76 28 90 33 102", "M24 56C13 72 13 92 20 108", "M164 64C172 76 172 90 167 102", "M176 56C187 72 187 92 180 108"],
  arcsM: ["M30 62C24 76 24 92 30 106", "M170 62C176 76 176 92 170 106"],
  plate: "M52 164H148",
  gloss: "M64 112C66 96 74 84 86 78",
  knob: 18, // knob diameter = the brand unit K
};
export const K = G.knob;

/** Colourways. `word` is the wordmark colour. */
export const WAYS = {
  color: { arc: C.ochre, plate: C.clay, dome: C.ochre, knob: C.ochre, rim: C.clay, word: C.clay },
  dark: { arc: C.ochre, plate: C.slip, dome: C.slip, knob: C.ochre, rim: C.slip, word: C.slip },
  ink: mono(C.ink),
  clay: mono(C.clay),
  ochre: mono(C.ochre),
  reverse: mono(C.slip),
};
function mono(c) {
  return { arc: c, plate: c, dome: c, knob: c, rim: c, word: c };
}

/** Mark inner SVG in grid coordinates. optic: L (full) / M (reduced) / S (minimal). */
export function mark(optic, p, id = "m") {
  if (optic === "S")
    return `<g transform="translate(0 -4)"><path d="${G.dome}" fill="${p.dome}"/><circle cx="100" cy="48" r="13" fill="${p.knob}"/><rect x="24" y="136" width="152" height="18" rx="9" fill="${p.rim}"/></g>`;
  if (optic === "M")
    return `<g transform="translate(0 -4)"><g fill="none" stroke="${p.arc}" stroke-width="9" stroke-linecap="round">${G.arcsM.map((d) => `<path d="${d}"/>`).join("")}</g><path d="${G.plate}" fill="none" stroke="${p.plate}" stroke-width="9" stroke-linecap="round"/><path d="${G.dome}" fill="${p.dome}"/><circle cx="100" cy="50" r="11" fill="${p.knob}"/><rect x="24" y="136" width="152" height="14" rx="7" fill="${p.rim}"/></g>`;
  return `<g transform="translate(0 -4)"><defs><mask id="${id}-g" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/><path d="${G.gloss}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/></mask></defs><g fill="none" stroke="${p.arc}" stroke-width="6" stroke-linecap="round">${G.arcsL.map((d) => `<path d="${d}"/>`).join("")}</g><path d="${G.plate}" fill="none" stroke="${p.plate}" stroke-width="6" stroke-linecap="round"/><path d="${G.dome}" fill="${p.dome}" mask="url(#${id}-g)"/><rect x="95" y="52" width="10" height="16" rx="3" fill="${p.knob}"/><circle cx="100" cy="50" r="9" fill="${p.knob}"/><rect x="24" y="136" width="152" height="12" rx="6" fill="${p.rim}"/></g>`;
}

export const svgDoc = (w, h, vb, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" role="img">${body}</svg>\n`;

export function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

/** Tight bounds of a grid-space drawing, measured by rasterising at 8x. */
export function measure(inner) {
  const r = new Resvg(svgDoc(200, 200, "0 0 200 200", inner), { fitTo: { mode: "width", value: 1600 } }).render();
  const { width, height } = r;
  const px = r.pixels;
  let x1 = width, y1 = height, x2 = 0, y2 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (px[(y * width + x) * 4 + 3] > 40) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
  const s = width / 200;
  return { x1: x1 / s, y1: y1 / s, x2: (x2 + 1) / s, y2: (y2 + 1) / s };
}

/** Outlined word. Returns path data with the baseline at y=0 and bbox relative to the origin. */
export function word(font, text, size) {
  const path = font.getPath(text, 0, 0, size);
  const b = path.getBoundingBox();
  return { d: path.toPathData(2), x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, size };
}
export const XH = 0.531; // Alexandria x-height / em
