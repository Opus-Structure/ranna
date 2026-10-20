import { WAYS, K, mark, measure, word, latin, arabic, XH, svgDoc } from "./lib.mjs";

/** Tight bounds of the full-size mark (no tile) in grid units. */
export const ART = (() => {
  const b = measure(mark("L", WAYS.ink, "m"));
  return { ...b, w: b.x2 - b.x1, h: b.y2 - b.y1 };
})();

/** Lockup proportions, all derived from mark height H and the knob unit K. */
export const SPEC = {
  xhH: 0.46, // horizontal: wordmark x-height as a share of mark height
  xhStack: 0.34, // stacked: smaller, because the word runs wider than the mark
  gapH: 2 * K, // mark ↔ word, horizontal lockups
  gapStack: 1.5 * K, // mark ↔ word, stacked lockups
  pairGap: 1.5 * K, // word ↔ divider ↔ word in bilingual lockups
  arScale: 1.04, // Arabic size relative to Latin so the two read at the same weight
  divider: 4,
};
const BASE = 144 - ART.y1; // the rim's lower edge, in mark-top-relative units: the shared baseline

const box = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const union = (bs) => ({
  x1: Math.min(...bs.map((b) => b.x1)),
  y1: Math.min(...bs.map((b) => b.y1)),
  x2: Math.max(...bs.map((b) => b.x2)),
  y2: Math.max(...bs.map((b) => b.y2)),
});

function wordEl(w, x, y, fill) {
  return {
    svg: `<path transform="translate(${r(x)} ${r(y)})" d="${w.d}" fill="${fill}"/>`,
    box: box(x + w.x1, y + w.y1, x + w.x2, y + w.y2),
  };
}
const r = (n) => Math.round(n * 100) / 100;

/** kind: mark | h | h-ar | h-bi | stack | stack-ar | stack-bi | word | word-ar | word-bi */
export function lockup(kind, way, id = "k") {
  const p = WAYS[way];
  const H = ART.h, W = ART.w;
  const sH = (SPEC.xhH * H) / XH;
  const sS = (SPEC.xhStack * H) / XH;
  const markEl = (x, y) => ({
    svg: `<g transform="translate(${r(x - ART.x1)} ${r(y - ART.y1)})">${mark("L", p, id)}</g>`,
    box: box(x, y, x + W, y + H),
  });
  const lat = (s) => word(latin, "ranna", s);
  const ara = (s) => word(arabic, "رنة", s * SPEC.arScale);
  /** ranna | رنة on baseline y, left edge at x. */
  const pair = (s, x, y) => {
    const a = lat(s), b = ara(s);
    const xhPx = XH * s;
    const ea = wordEl(a, x - a.x1, y, p.word);
    const dx = x + (a.x2 - a.x1) + SPEC.pairGap;
    const div = {
      svg: `<rect x="${r(dx)}" y="${r(y - xhPx * 0.5 - xhPx * 0.85)}" width="${SPEC.divider}" height="${r(xhPx * 1.7)}" rx="${SPEC.divider / 2}" fill="${p.arc}"/>`,
      box: box(dx, y - xhPx * 1.35, dx + SPEC.divider, y + xhPx * 0.35),
    };
    const eb = wordEl(b, dx + SPEC.divider + SPEC.pairGap - b.x1, y, p.word);
    return [ea, div, eb];
  };
  const pairW = (s) => {
    const a = lat(s), b = ara(s);
    return a.x2 - a.x1 + b.x2 - b.x1 + 2 * SPEC.pairGap + SPEC.divider;
  };

  let els = [];
  switch (kind) {
    case "mark":
      els = [markEl(0, 0)];
      break;
    case "h": {
      const a = lat(sH);
      els = [markEl(0, 0), wordEl(a, W + SPEC.gapH - a.x1, BASE, p.word)];
      break;
    }
    case "h-ar": {
      const b = ara(sH);
      const bw = b.x2 - b.x1;
      els = [wordEl(b, -b.x1, BASE, p.word), markEl(bw + SPEC.gapH, 0)];
      break;
    }
    case "h-bi":
      els = [markEl(0, 0), ...pair(sH, W + SPEC.gapH, BASE)];
      break;
    case "stack": {
      const a = lat(sS), aw = a.x2 - a.x1, T = Math.max(W, aw);
      els = [markEl((T - W) / 2, 0), wordEl(a, (T - aw) / 2 - a.x1, H + SPEC.gapStack - a.y1, p.word)];
      break;
    }
    case "stack-ar": {
      const b = ara(sS), bw = b.x2 - b.x1, T = Math.max(W, bw);
      els = [markEl((T - W) / 2, 0), wordEl(b, (T - bw) / 2 - b.x1, H + SPEC.gapStack - b.y1, p.word)];
      break;
    }
    case "stack-bi": {
      const pw = pairW(sS), T = Math.max(W, pw);
      els = [markEl((T - W) / 2, 0), ...pair(sS, (T - pw) / 2, H + SPEC.gapStack - Math.min(lat(sS).y1, ara(sS).y1))];
      break;
    }
    case "word":
      els = [wordEl(lat(sH), -lat(sH).x1, 0, p.word)];
      break;
    case "word-ar":
      els = [wordEl(ara(sH), -ara(sH).x1, 0, p.word)];
      break;
    case "word-bi":
      els = pair(sH, 0, 0);
      break;
    default:
      throw new Error(kind);
  }
  const b = union(els.map((e) => e.box));
  const w = r(b.x2 - b.x1), h = r(b.y2 - b.y1);
  const body = `<g transform="translate(${r(-b.x1)} ${r(-b.y1)})">${els.map((e) => e.svg).join("")}</g>`;
  return { svg: svgDoc(w, h, `0 0 ${w} ${h}`, body), w, h, els, bounds: b, markBox: els.find((e) => e.svg.includes("mask") || e.svg.includes("rx=\"6\""))?.box };
}
