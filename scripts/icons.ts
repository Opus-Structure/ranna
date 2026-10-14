/**
 * `npm run icons`: renders the app icons in public/icons from the brand mark
 * (src/components/brand/brand-mark.tsx) on the fired-clay plate. The PNGs are committed;
 * re-run this after changing the mark or the clay colour. Provenance: generated, not drawn.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CLAY = "#76291d"; // --clay, oklch(0.38 0.105 30)
const SLIP = "#f6efe6"; // --clay-foreground

/** The mark centred on a square plate; `inset` leaves room for maskable safe zones. */
function svg(size: number, inset: number, rounded: boolean) {
  const mark = size * (1 - inset * 2);
  const scale = mark / 32;
  const offset = size * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${CLAY}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${SLIP}" stroke-width="1.5">
    <path d="M16 2 30 16 16 30 2 16Z"/>
    <path d="M16 8 24 16 16 24 8 16Z"/>
    <path d="M16 12.5 19.5 16 16 19.5 12.5 16Z" fill="${SLIP}" stroke="none"/>
  </g>
</svg>`;
}

const out = "public/icons";
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/icon.svg`, svg(512, 0.18, true));
const pngs: [string, number, number, boolean][] = [
  ["icon-192.png", 192, 0.18, true],
  ["icon-512.png", 512, 0.18, true],
  // Maskable: full-bleed plate, mark inside the 80% safe zone.
  ["maskable-512.png", 512, 0.24, false],
  // iOS rounds the corners itself.
  ["apple-touch-icon.png", 180, 0.2, false],
];
for (const [name, size, inset, rounded] of pngs) {
  await sharp(Buffer.from(svg(size, inset, rounded))).png().toFile(`${out}/${name}`);
}
console.info(`icons written to ${out}`);
