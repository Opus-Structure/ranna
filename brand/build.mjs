/** Generates every logo file in /brand from the geometry in lib.mjs + lockups.mjs. `npm run build`. */
import { mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { C, WAYS, mark, measure, png, svgDoc } from "./lib.mjs";
import { ART, SPEC, lockup } from "./lockups.mjs";
import { buildGuide } from "./guide.mjs";

for (const d of ["svg", "png", "app-icons", "social", "fonts"]) {
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
}
const out = (path, data) => writeFileSync(path, data);

/* ───────────── tiles ───────────── */
export const TILES = {
  ochre: { ground: C.ochre, p: { arc: C.slip, plate: C.slip, dome: C.slip, knob: C.slip, rim: C.slip } },
  clay: { ground: C.clay, p: { arc: C.ochre, plate: C.slip, dome: C.slip, knob: C.ochre, rim: C.slip } },
  ink: { ground: C.ink, p: { arc: C.slip, plate: C.slip, dome: C.ochre, knob: C.ochre, rim: C.ochre } },
  slip: { ground: C.slip, stroke: C.hairline, p: { arc: C.ochre, plate: C.clay, dome: C.ochre, knob: C.ochre, rim: C.clay } },
};
export function tile(style, optic = "L", { id = "t", radius = 44, bleed = false, scale = 1 } = {}) {
  const t = TILES[style];
  const ground = bleed
    ? `<rect width="200" height="200" fill="${t.ground}"/>`
    : t.stroke
      ? `<rect x="1" y="1" width="198" height="198" rx="${radius - 1}" fill="${t.ground}" stroke="${t.stroke}" stroke-width="2"/>`
      : `<rect width="200" height="200" rx="${radius}" fill="${t.ground}"/>`;
  const m = mark(optic, t.p, id);
  const body = scale === 1 ? m : `<g transform="translate(${100 - 100 * scale} ${100 - 100 * scale}) scale(${scale})">${m}</g>`;
  return svgDoc(200, 200, "0 0 200 200", ground + body);
}
for (const s of Object.keys(TILES)) {
  out(`svg/tile-${s}.svg`, tile(s, "L"));
  out(`svg/tile-${s}-m.svg`, tile(s, "M"));
  out(`svg/tile-${s}-s.svg`, tile(s, "S"));
}

/* ───────────── marks (no tile) ───────────── */
const crop = (inner) => {
  const b = measure(inner);
  return svgDoc(b.x2 - b.x1, b.y2 - b.y1, `${b.x1} ${b.y1} ${b.x2 - b.x1} ${b.y2 - b.y1}`, inner);
};
for (const [way, p] of Object.entries(WAYS)) {
  out(`svg/mark-${way}.svg`, crop(mark("L", p, "m")));
  out(`svg/mark-${way}-m.svg`, crop(mark("M", p, "m")));
  out(`svg/mark-${way}-s.svg`, crop(mark("S", p, "m")));
}

/* ───────────── lockups + wordmarks ───────────── */
export const KINDS = ["h", "h-ar", "h-bi", "stack", "stack-ar", "stack-bi", "word", "word-ar", "word-bi"];
const NAMES = { h: "lockup-horizontal", "h-ar": "lockup-horizontal-ar", "h-bi": "lockup-horizontal-bilingual", stack: "lockup-stacked", "stack-ar": "lockup-stacked-ar", "stack-bi": "lockup-stacked-bilingual", word: "wordmark", "word-ar": "wordmark-ar", "word-bi": "wordmark-bilingual" };
export const geometry = {};
for (const k of KINDS)
  for (const way of Object.keys(WAYS)) {
    const l = lockup(k, way, "k");
    out(`svg/${NAMES[k]}-${way}.svg`, l.svg);
    if (way === "color" || way === "reverse") out(`png/${NAMES[k]}-${way}@1600.png`, png(l.svg, 1600));
    if (way === "color") geometry[k] = { w: l.w, h: l.h };
  }

/* ───────────── PNG tiles (right optic per size) ───────────── */
const optic = (px) => (px >= 64 ? "L" : px >= 40 ? "M" : "S");
for (const px of [16, 32, 48, 64, 96, 128, 256, 512, 1024]) out(`png/tile-ochre-${px}.png`, png(tile("ochre", optic(px)), px));
for (const s of ["clay", "ink", "slip"]) out(`png/tile-${s}-512.png`, png(tile(s, "L"), 512));
for (const way of ["color", "reverse", "ink"]) out(`png/mark-${way}-1024.png`, png(crop(mark("L", WAYS[way], "m")), 1024));

/* ───────────── app icons (full-bleed where the OS rounds it) ───────────── */
out("app-icons/favicon.svg", tile("ochre", "S", { radius: 44 }));
const sq = (px, s = 1) => png(tile("ochre", optic(px), { bleed: true, scale: s }), px);
for (const px of [16, 32, 48]) out(`app-icons/favicon-${px}.png`, png(tile("ochre", optic(px)), px));
out("app-icons/apple-touch-icon.png", sq(180)); // iOS applies its own corner mask
out("app-icons/icon-192.png", png(tile("ochre", "L"), 192));
out("app-icons/icon-512.png", png(tile("ochre", "L"), 512));
out("app-icons/maskable-512.png", sq(512, 0.78)); // mark stays inside the 80% safe circle
out("app-icons/maskable-192.png", sq(192, 0.78));
// favicon.ico = 16/32/48 PNG frames
{
  const frames = [16, 32, 48].map((px) => png(tile("ochre", optic(px)), px));
  const head = Buffer.alloc(6 + 16 * frames.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let off = head.length;
  frames.forEach((f, i) => {
    const px = [16, 32, 48][i];
    head.writeUInt8(px, 6 + i * 16);
    head.writeUInt8(px, 7 + i * 16);
    head.writeUInt16LE(1, 10 + i * 16);
    head.writeUInt16LE(32, 12 + i * 16);
    head.writeUInt32LE(f.length, 14 + i * 16);
    head.writeUInt32LE(off, 18 + i * 16);
    off += f.length;
  });
  out("app-icons/favicon.ico", Buffer.concat([head, ...frames]));
}

/* ───────────── social ───────────── */
out("social/avatar-1024.png", sq(1024, 0.7)); // platforms crop to a circle: keep inside the safe area
{
  const l = lockup("h-bi", "reverse", "og");
  const W = 1200, H = 630, s = (W * 0.62) / l.w;
  const inner = l.svg.replace(/^<svg[^>]*>/, "").replace("</svg>\n", "");
  const doc = svgDoc(W, H, `0 0 ${W} ${H}`, `<rect width="${W}" height="${H}" fill="${C.ochre}"/><g transform="translate(${(W - l.w * s) / 2} ${(H - l.h * s) / 2}) scale(${s})">${inner}</g>`);
  out("social/og-1200x630.png", png(doc, W));
}

/* ───────────── fonts used by the guide ───────────── */
const f = "node_modules/@fontsource";
for (const [src, dst] of [
  ["alexandria/files/alexandria-latin-700-normal.woff2", "alexandria-latin-700.woff2"],
  ["alexandria/files/alexandria-arabic-700-normal.woff2", "alexandria-arabic-700.woff2"],
  ["inter/files/inter-latin-400-normal.woff2", "inter-latin-400.woff2"],
  ["inter/files/inter-latin-600-normal.woff2", "inter-latin-600.woff2"],
  ["cairo/files/cairo-arabic-400-normal.woff2", "cairo-arabic-400.woff2"],
  ["cairo/files/cairo-arabic-700-normal.woff2", "cairo-arabic-700.woff2"],
]) copyFileSync(`${f}/${src}`, `fonts/${dst}`);

writeFileSync("geometry.json", JSON.stringify({ art: ART, spec: SPEC, unitK: 18, lockups: geometry }, null, 2));
await buildGuide({ tile, crop, TILES, KINDS, NAMES });
console.info("brand: built");

/* ───────────── app component data ───────────── */
{
  const css = { arc: "var(--brand-dome, currentColor)", plate: "var(--brand-rim, currentColor)", dome: "var(--brand-dome, currentColor)", knob: "var(--brand-dome, currentColor)", rim: "var(--brand-rim, currentColor)" };
  const optics = {};
  for (const o of ["L", "M", "S"]) {
    const inner = mark(o, css, "brand");
    const b = measure(mark(o, WAYS.ink, "brand"));
    optics[o] = { viewBox: `${b.x1} ${b.y1} ${b.x2 - b.x1} ${b.y2 - b.y1}`, w: +(b.x2 - b.x1).toFixed(2), h: +(b.y2 - b.y1).toFixed(2), inner };
  }
  const words = {};
  for (const [k, kind] of [["pair", "word-bi"], ["latin", "word"], ["arabic", "word-ar"]]) {
    const l = lockup(kind, "ink", "w");
    words[k] = { w: l.w, h: l.h, inner: l.svg.replace(/^<svg[^>]*>/, "").replace("</svg>\n", "").replaceAll(C.ink, "currentColor") };
  }
  WAYS.css = { ...css, word: "currentColor" };
  const lockups = {};
  for (const [k, kind] of [["bilingual", "h-bi"], ["latin", "h"], ["arabic", "h-ar"]]) {
    const l = lockup(kind, "css", "lk");
    lockups[k] = { w: l.w, h: l.h, inner: l.svg.replace(/^<svg[^>]*>/, "").replace("</svg>\n", "") };
  }
  writeFileSync(
    "../src/components/brand/logo-data.ts",
    `/* Generated by brand/build.mjs (npm run build in /brand). Do not edit by hand. */\nexport const MARK = ${JSON.stringify(optics, null, 2)} as const;\n\nexport const WORDMARK = ${JSON.stringify(words, null, 2)} as const;\n\nexport const LOCKUP = ${JSON.stringify(lockups, null, 2)} as const;\n`,
  );
}
