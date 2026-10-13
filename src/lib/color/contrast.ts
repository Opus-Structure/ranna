/**
 * Colour maths for WCAG contrast. Used to keep our tokens honest and, from phase 3, to pick a
 * readable text colour on each merchant's brand colours and warn when a pair fails.
 */

export type Rgb = { r: number; g: number; b: number }; // 0..1, gamma-encoded sRGB

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** OKLCH (L 0..1, C, h degrees) to gamma-encoded sRGB, clamped to gamut. */
export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => toGamma(Math.min(1, Math.max(0, v))));
  return { r: lin[0]!, g: lin[1]!, b: lin[2]! };
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: Rgb = { r: 1, g: 1, b: 1 };
const INK: Rgb = { r: 0x1f / 255, g: 0x17 / 255, b: 0x15 / 255 };

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: Rgb): { color: Rgb; ratio: number } {
  const white = contrastRatio(WHITE, background);
  const ink = contrastRatio(INK, background);
  return white >= ink ? { color: WHITE, ratio: white } : { color: INK, ratio: ink };
}

/** Mixes toward black (amount > 0) or white (amount < 0) in linear light. */
export function shade(color: Rgb, amount: number): Rgb {
  const target = amount >= 0 ? 0 : 1;
  const t = Math.min(1, Math.abs(amount));
  const mix = (c: number) => toGamma(toLinear(c) + (target - toLinear(c)) * t);
  return { r: mix(color.r), g: mix(color.g), b: mix(color.b) };
}

/**
 * Darkens (or lightens) `color` in small steps until it reaches `min` contrast against
 * `against`. Used to derive an accessible link/accent colour from any brand colour.
 */
export function ensureContrast(color: Rgb, against: Rgb, min: number): Rgb {
  if (contrastRatio(color, against) >= min) return color;
  const direction = relativeLuminance(against) > 0.5 ? 1 : -1;
  for (let step = 1; step <= 40; step++) {
    const candidate = shade(color, (direction * step) / 40);
    if (contrastRatio(candidate, against) >= min) return candidate;
  }
  return direction > 0 ? INK : WHITE;
}
