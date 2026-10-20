import { writeFileSync } from "node:fs";
import { C, WAYS, K, XH, mark, svgDoc } from "./lib.mjs";
import { ART, SPEC, lockup } from "./lockups.mjs";

/* ── colour maths ── */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const hex = (r, g, b) =>
  "#" +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
export const COLORS = [
  { name: "Red Ochre", token: "ochre", src: "red-ochre", hex: C.ochre, role: "The ring. Mark, accents, large display; also AA for text on paper." },
  { name: "Fired Clay", token: "clay", src: "fired-clay", hex: C.clay, role: "Wordmark, rim, dark grounds." },
  { name: "Clay Slip", token: "slip", src: "clay-slip", hex: C.slip, role: "Mark on dark or ochre; card ground." },
  { name: "Slip White", token: "paper", src: "slip-white", hex: C.paper, role: "Default ground." },
  { name: "Manganese Ink", token: "ink", src: "manganese-ink", hex: C.ink, role: "Body text, one-colour print, dark ground." },
  { name: "Hairline", token: "hairline", src: "hairline", hex: C.hairline, role: "Rules, tile edge on light grounds." },
];

const uri = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
const img = (svg, style = "", alt = "") => `<img alt="${alt}" style="${style}" src="${uri(svg)}">`;
let uid = 0;
const nid = () => `g${++uid}`;
const inner = (svg) => svg.replace(/^<svg[^>]*>/, "").replace("</svg>\n", "");

export async function buildGuide({ tile, crop, TILES, KINDS, NAMES }) {
  const H = ART.h;
  const W = ART.w;
  const BASE = 144 - ART.y1;

  /* the mark inside any lockup is never narrower than this many px */
  const MARK_MIN = 54;
  const minW = (k) => Math.ceil((MARK_MIN * lockup(k, "color", nid()).w) / ART.w / 4) * 4;
  const mm = (p) => Math.round(p * 0.2646);

  /* ── diagrams ── */
  const construction = (() => {
    const pad = 30;
    const s = 3.4;
    const vbW = W + pad * 2 + 34;
    const vbH = H + pad * 2 + 30;
    const m = mark("L", WAYS.color, nid());
    const line = (x1, y1, x2, y2, c = C.clay) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width=".5"/>`;
    const t = (x, y, str, a = "start") => `<text x="${x}" y="${y}" font-family="Inter,sans-serif" font-size="7" text-anchor="${a}" fill="${C.clay}">${str}</text>`;
    let o = `<g transform="translate(${pad - ART.x1} ${pad - ART.y1})">${m}</g>`;
    o += `<rect x="${pad}" y="${pad}" width="${W}" height="${H}" fill="none" stroke="${C.clay}" stroke-width=".5" stroke-dasharray="2 2"/>`;
    for (let i = 1; i < 7; i++) o += line(pad, pad + i * K, pad + W, pad + i * K, C.hairline);
    const kx = pad + (100 - ART.x1);
    const ky = pad + (46 - ART.y1);
    o += `<circle cx="${kx}" cy="${ky}" r="${K / 2}" fill="none" stroke="${C.clay}" stroke-width=".7"/>`;
    o += line(pad + W + 8, pad, pad + W + 8, pad + H) + t(pad + W + 11, pad + H / 2 + 2, "H = 7K");
    o += line(pad, pad + H + 8, pad + W, pad + H + 8) + t(pad + W / 2, pad + H + 15, `W = ${(W / K).toFixed(2)}K`, "middle");
    o += t(kx + 14, ky + 2, "K = handle Ø");
    return svgDoc(vbW * s, vbH * s, `0 0 ${vbW} ${vbH}`, `<rect width="100%" height="100%" fill="${C.paper}"/>` + o);
  })();

  const clearSpace = (() => {
    const l = lockup("h-bi", "color", nid());
    const c = 2 * K;
    const pad = c + 12;
    const vw = l.w + pad * 2;
    const vh = l.h + pad * 2;
    let o = `<rect width="100%" height="100%" fill="${C.paper}"/>`;
    o += `<rect x="${pad - c}" y="${pad - c}" width="${l.w + 2 * c}" height="${l.h + 2 * c}" fill="${C.ochre}" fill-opacity=".1" stroke="${C.ochre}" stroke-width=".8" stroke-dasharray="3 3"/>`;
    o += `<rect x="${pad}" y="${pad}" width="${l.w}" height="${l.h}" fill="${C.paper}"/>`;
    o += `<g transform="translate(${pad} ${pad})">${inner(l.svg)}</g>`;
    o += `<rect x="${pad}" y="${pad}" width="${l.w}" height="${l.h}" fill="none" stroke="${C.clay}" stroke-width=".6"/>`;
    const sq = (x, y) =>
      `<rect x="${x}" y="${y}" width="${K}" height="${K}" fill="${C.ochre}" fill-opacity=".35" stroke="${C.ochre}" stroke-width=".6"/><text x="${x + K / 2}" y="${y + K / 2 + 3.5}" font-family="Inter" font-size="14" font-weight="600" text-anchor="middle" fill="${C.ochre}">K</text>`;
    const my = pad + l.h / 2 - K / 2;
    const mx = pad + l.w / 2 - K / 2;
    for (const [x, y] of [[pad - c, my], [pad - c + K, my], [pad + l.w, my], [pad + l.w + K, my], [mx, pad - c], [mx, pad - c + K], [mx, pad + l.h], [mx, pad + l.h + K]]) o += sq(x, y);
    return svgDoc(vw * 2, vh * 2, `0 0 ${vw} ${vh}`, o);
  })();

  const spacing = (() => {
    const l = lockup("h-bi", "color", nid());
    const pad = 26;
    const vw = l.w + pad * 2;
    const vh = l.h + pad * 2 + 20;
    const baseY = pad + BASE - l.bounds.y1;
    const markR = pad - l.bounds.x1 + W;
    const gapEnd = markR + SPEC.gapH;
    const right = pad + l.w;
    const tx = (x, y, str, a = "middle") => `<text x="${x}" y="${y}" font-family="Inter" font-size="13" font-weight="600" text-anchor="${a}" fill="${C.clay}">${str}</text>`;
    let o = `<rect width="100%" height="100%" fill="${C.paper}"/><g transform="translate(${pad} ${pad})">${inner(l.svg)}</g>`;
    o += `<line x1="${pad - 8}" x2="${right + 8}" y1="${baseY}" y2="${baseY}" stroke="${C.ochre}" stroke-width=".7" stroke-dasharray="3 2"/>`;
    o += `<rect x="${markR}" y="${pad - 14}" width="${SPEC.gapH}" height="9" fill="${C.ochre}" fill-opacity=".35"/>` + tx(markR + SPEC.gapH / 2, pad - 6.5, "2K");
    o += `<line x1="${pad}" x2="${markR}" y1="${pad + l.h + 12}" y2="${pad + l.h + 12}" stroke="${C.clay}" stroke-width=".7"/>` + tx((pad + markR) / 2, pad + l.h + 22, "mark");
    o += `<line x1="${gapEnd}" x2="${right}" y1="${pad + l.h + 12}" y2="${pad + l.h + 12}" stroke="${C.clay}" stroke-width=".7"/>` + tx((gapEnd + right) / 2, pad + l.h + 22, "wordmark pair");
    return svgDoc(vw * 2, vh * 2, `0 0 ${vw} ${vh}`, o);
  })();

  /* ── sections ── */
  const WAY_NAME = { color: "Colour", dark: "On dark", reverse: "Reverse", ink: "One colour · ink", clay: "One colour · clay", ochre: "One colour · ochre" };
  const way = (name, ground, textc, kind = "h-bi", w = 300) => {
    const l = lockup(kind, name, nid());
    return `<figure class="cell" style="background:${ground};color:${textc}"><div class="stage">${img(l.svg, `width:${w}px;max-width:86%`)}</div><figcaption>${WAY_NAME[name]} on <b>${ground.toUpperCase()}</b></figcaption></figure>`;
  };

  const swatches = COLORS.map((c) => {
    const [r, g, b] = rgb(c.hex);
    const onT = ratio(c.hex, "#FFFFFF") >= ratio(c.hex, C.ink) ? "#fff" : C.ink;
    const edge = ["hairline", "paper", "slip"].includes(c.token) ? ";box-shadow:inset 0 0 0 1px ${C.hairline}" : "";
    return `<div class="sw"><div class="chip" style="background:${c.hex};color:${onT}${edge}"><b>${c.name}</b><span>${c.hex}</span></div><dl><dt>RGB</dt><dd>${r} ${g} ${b}</dd><dt>Token</dt><dd><code>--ranna-${c.token}</code> = DESIGN.md <code>${c.src}</code></dd><dt>Use</dt><dd>${c.role}</dd></dl></div>`;
  }).join("");

  const pairs = [
    ["Ink", C.ink, "Paper", C.paper],
    ["Manganese Ink", C.ink, "Slip White", C.paper],
    ["Fired Clay", C.clay, "Slip White", C.paper],
    ["Fired Clay", C.clay, "Clay Slip", C.slip],
    ["Clay Slip", C.slip, "Fired Clay", C.clay],
    ["Clay Slip", C.slip, "Manganese Ink", C.ink],
    ["Red Ochre", C.ochre, "Slip White", C.paper],
    ["Red Ochre", C.ochre, "Fired Clay", C.clay],
    ["Red Ochre", C.ochre, "Manganese Ink", C.ink],
    ["Clay Slip", C.slip, "Red Ochre", C.ochre],
    ["Slip White", C.paper, "Red Ochre", C.ochre],
    ["Manganese Ink", C.ink, "Red Ochre", C.ochre],
  ];
  const verdict = (r) => (r >= 7 ? ["AAA", "ok"] : r >= 4.5 ? ["AA, any text", "ok"] : r >= 3 ? ["Large text and graphics only", "warn"] : ["Fails: do not pair", "no"]);
  const contrast = pairs
    .map(([a, ah, b, bh]) => {
      const r = ratio(ah, bh);
      const [v, cls] = verdict(r);
      return `<tr><td><i class="dot" style="background:${ah}"></i>${a}</td><td><i class="dot" style="background:${bh}"></i>${b}</td><td class="num">${r.toFixed(2)} : 1</td><td class="${cls}">${v}</td></tr>`;
    })
    .join("");

  const opticRow = [
    ["L", 96, "Full: ring arcs, gloss, plate line, handle stem. Tile 64 px and up."],
    ["M", 48, "Reduced: one heavier arc per side, no gloss or stem. Tile 40 to 63 px."],
    ["S", 32, "Minimal: dome, handle, rim. Tile 16 to 39 px, favicon."],
  ]
    .map(
      ([o, size, d]) =>
        `<div class="optic"><div class="px">${img(tile("ochre", o), `width:${size}px;height:${size}px`, o)}${size === 32 ? img(tile("ochre", "S"), "width:16px;height:16px;margin-left:12px", "16") : ""}</div><h4>${o} <small>at ${size}px${size === 32 ? " and 16px" : ""}</small></h4><p>${d}</p></div>`,
    )
    .join("");

  const minTable = [
    ["Mark, with tile", "64 px", `${mm(64)} mm`, "Full (L) from 64 px. Use M below 64 and S below 40."],
    ["Mark, no tile", `${MARK_MIN} px wide`, `${mm(MARK_MIN)} mm`, "Same optics apply. Below 40 px wide use S."],
    ...[["h", "Horizontal"], ["h-ar", "Horizontal, Arabic"], ["h-bi", "Horizontal, bilingual"], ["stack", "Stacked"], ["stack-ar", "Stacked, Arabic"], ["stack-bi", "Stacked, bilingual"]].map(([k, n]) => [n, `${minW(k)} px wide`, `${mm(minW(k))} mm`, "Smaller than this: use the mark alone."]),
    ["Wordmark only", "72 px wide", `${mm(72)} mm`, "Latin. Arabic wordmark: 56 px wide."],
  ]
    .map(([n, a, b, c]) => `<tr><td>${n}</td><td class="num">${a}</td><td class="num">${b}</td><td>${c}</td></tr>`)
    .join("");

  const lib = KINDS.map((k) => {
    const l = lockup(k, "color", nid());
    const wpx = k.startsWith("word") ? 220 : k.startsWith("stack") ? 150 : 250;
    return `<figure class="lib"><div class="stage">${img(l.svg, `width:${wpx}px;max-width:90%`)}</div><figcaption><code>${NAMES[k]}-{way}.svg</code></figcaption></figure>`;
  }).join("");

  const tiles = Object.keys(TILES)
    .map((s) => `<figure class="lib"><div class="stage">${img(tile(s, "L"), "width:120px")}</div><figcaption><code>tile-${s}.svg</code> (+ -m, -s)</figcaption></figure>`)
    .join("");

  const markWays = Object.keys(WAYS)
    .map((w2) => {
      const ground = w2 === "dark" ? C.clay : w2 === "reverse" ? C.ochre : C.paper;
      const fg = w2 === "dark" || w2 === "reverse" ? C.slip : C.ink;
      return `<figure class="cell sm" style="background:${ground};color:${fg}"><div class="stage">${img(crop(mark("L", WAYS[w2], nid())), "width:110px")}</div><figcaption>mark-${w2}.svg</figcaption></figure>`;
    })
    .join("");

  const mis = (() => {
    const l = lockup("h", "color", nid());
    const wrap = (body, bg = C.paper) => svgDoc(600, 240, "0 0 300 120", `<rect width="100%" height="100%" fill="${bg}"/>${body}`);
    const S = 230 / l.w;
    const place = (attrs = "", bg = C.paper, src = l.svg, extraDefs = "", sc = S, sx = 1) =>
      wrap(`${extraDefs}<g transform="translate(${(300 - l.w * sc * sx) / 2} ${(120 - l.h * sc) / 2}) scale(${sc})"><g ${attrs}>${inner(src)}</g></g>`, bg);
    const purple = lockup("h", "color", nid()).svg.replaceAll(C.ochre, "#7A4FD6").replaceAll(C.clay, "#2E9AA8");
    const outline = lockup("h", "ink", nid()).svg.replace(/fill="#1A1A1A"/g, `fill="none" stroke="${C.ink}" stroke-width="2"`);
    const lowc = place("", "#E0705F", lockup("h", "ochre", nid()).svg);
    const swapped = (() => {
      const m = crop(mark("L", WAYS.color, nid()));
      const lw = lockup("word", "color", nid());
      return wrap(`<g transform="translate(18 44) scale(.5)">${inner(lw.svg)}</g><g transform="translate(190 30) scale(.5)">${inner(m)}</g>`);
    })();
    const crowd = (() => {
      const ls = lockup("h", "color", nid());
      const sc = 0.78 * S, x0 = (300 - ls.w * sc) / 2, y0 = (120 - ls.h * sc) / 2;
      return wrap(`<g transform="translate(${x0} ${y0}) scale(${sc})">${inner(ls.svg)}</g><rect x="${x0 - 3}" y="${y0 - 3}" width="${ls.w * sc + 6}" height="${ls.h * sc + 6}" fill="none" stroke="${C.ink}" stroke-width="1.4"/>`);
    })();
    const font = (() => {
      const m = crop(mark("L", WAYS.color, nid()));
      return wrap(`<g transform="translate(18 28) scale(.5)">${inner(m)}</g><text x="122" y="75" font-family="Times New Roman, serif" font-style="italic" font-size="38" fill="${C.clay}">Ranna</text>`);
    })();
    const small = (() => {
      const m = crop(mark("L", WAYS.color, nid()));
      return wrap(`<g transform="translate(30 45) scale(.12)">${inner(m)}</g><g transform="translate(90 40) scale(.2)">${inner(m)}</g><text x="150" y="70" font-size="9" font-family="Inter" fill="${C.ink}">full mark at tiny size</text>`);
    })();
    const photo = wrap(`<defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="#d89a4a"/><stop offset=".5" stop-color="#e8c27a"/><stop offset="1" stop-color="#b6643d"/></linearGradient></defs><rect width="300" height="120" fill="url(#pg)"/><g transform="translate(${(300 - l.w * S) / 2} ${(120 - l.h * S) / 2}) scale(${S})">${inner(l.svg)}</g>`);
    const shadow = place('filter="url(#sh)"', C.paper, l.svg, `<defs><filter id="sh" x="-10%" y="-10%" width="130%" height="150%"><feDropShadow dx="6" dy="10" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter></defs>`);
    return [
      ["Don't stretch or squash", place('transform="scale(1.3 .75)"', C.paper, l.svg, "", S * 0.76, 1.3)],
      ["Don't rotate or tilt", place('transform="rotate(-9)"', C.paper, l.svg, "", S * 0.9)],
      ["Don't recolour off palette", place("", C.paper, purple)],
      ["Don't outline the logo", place("", C.paper, outline)],
      ["Don't add shadows or effects", shadow],
      ["Don't put ochre on an ochre-ish ground", lowc],
      ["Don't use busy or low-contrast photos", photo],
      ["Don't swap mark and word order", swapped],
      ["Don't box it in or crowd it", crowd],
      ["Don't retype the wordmark", font],
      ["Don't use the full mark tiny: switch optic", small],
    ]
      .map(([cap, s]) => `<figure class="mis"><div class="stage">${img(s, "width:100%")}</div><figcaption><i>x</i> ${cap}</figcaption></figure>`)
      .join("");
  })();

  const hero = lockup("h-bi", "color", nid());
  const heroStack = lockup("stack-bi", "reverse", nid());

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ranna Brand Guide</title>
<style>
@font-face{font-family:Alexandria;font-weight:700;src:url(fonts/alexandria-latin-700.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Alexandria;font-weight:700;src:url(fonts/alexandria-arabic-700.woff2) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}
@font-face{font-family:Inter;font-weight:400;src:url(fonts/inter-latin-400.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:600;src:url(fonts/inter-latin-600.woff2) format("woff2")}
@font-face{font-family:Cairo;font-weight:400;src:url(fonts/cairo-arabic-400.woff2) format("woff2")}
@font-face{font-family:Cairo;font-weight:700;src:url(fonts/cairo-arabic-700.woff2) format("woff2")}
:root{--ochre:${C.ochre};--clay:${C.clay};--slip:${C.slip};--paper:${C.paper};--ink:${C.ink};--sand:${C.hairline}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/1.55 Inter,Cairo,system-ui,sans-serif}
main{max-width:1120px;margin:0 auto;padding:0 20px 96px}
h1,h2,h3,h4{font-family:Alexandria,Inter,Cairo,sans-serif;font-weight:700;letter-spacing:-.01em;line-height:1.15;margin:0}
header.top{padding:56px 0 24px;display:flex;flex-wrap:wrap;gap:32px;align-items:center;justify-content:space-between}
header.top p{max-width:46ch;margin:12px 0 0;color:#1a1a1ab8}
h1{font-size:clamp(2rem,5vw,3.4rem)}
section{padding:56px 0 8px;border-top:1px solid var(--sand);margin-top:40px}
section>h2{font-size:1.7rem;margin-bottom:6px}section>h2 span{color:var(--ochre);margin-right:.5em;font-size:.9em}
.lede{max-width:62ch;margin:0 0 28px;color:#1a1a1ab8}
.row{display:grid;gap:20px}.row>*,.two>*{min-width:0}.two{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.three{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.four{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.hero{display:grid;grid-template-columns:2fr 1fr;gap:20px}@media(max-width:760px){.hero{grid-template-columns:1fr}}
.panel{border-radius:20px;border:1px solid var(--sand);padding:20px;overflow:hidden}
.panel img{display:block;width:100%;height:auto;border-radius:14px}
.cell,.lib,.mis{margin:0;border-radius:16px;border:1px solid var(--sand);overflow:hidden;display:flex;flex-direction:column}
.stage{display:flex;align-items:center;justify-content:center;padding:28px 12px;min-height:150px}
.stage img{height:auto;display:block}
.cell.sm .stage{min-height:120px}
figcaption{font-size:.8rem;padding:10px 14px;border-top:1px solid #8883;margin-top:auto}
.cell figcaption{opacity:.85}.lib figcaption{color:#1a1a1aa6}
.mis .stage{padding:0;min-height:0}.mis figcaption i{color:#c0392b;font-style:normal;font-weight:700;margin-right:6px}
code{font:500 .82em ui-monospace,Menlo,monospace;background:#1a1a1a12;padding:1px 6px;border-radius:6px}
.sw .chip{border-radius:16px;padding:18px;height:110px;display:flex;flex-direction:column;justify-content:space-between}.sw .chip b{font:700 1rem Alexandria,sans-serif}.sw .chip span{font:600 .9rem Inter;letter-spacing:.04em}
.sw dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:12px 4px;font-size:.84rem}.sw dt{color:#1a1a1a8c}.sw dd{margin:0}
table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--sand);vertical-align:top}th{font-weight:600;color:#1a1a1a99;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}.ok{color:#1b7a52}.warn{color:#9a6a00}.no{color:#b3261e}.dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;box-shadow:inset 0 0 0 1px #0002;vertical-align:-1px}
.optic{padding:18px;border:1px solid var(--sand);border-radius:16px}.optic .px{height:110px;display:flex;align-items:flex-end}.optic h4{margin:12px 0 4px}.optic small{font:400 .8rem Inter;opacity:.6}.optic p{margin:0;font-size:.85rem;opacity:.8}
.type{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.spec{padding:24px;border:1px solid var(--sand);border-radius:16px}
.spec .big{font-size:3.4rem;line-height:1.2;margin:6px 0 10px}.spec small{display:block;opacity:.65;font-size:.82rem}
.ar{font-family:Alexandria,Cairo,sans-serif;direction:rtl}.cairo{font-family:Cairo,sans-serif;direction:rtl}
ul.rules{padding-left:1.1em;max-width:70ch}ul.rules li{margin:6px 0}
footer{margin-top:72px;padding-top:24px;border-top:1px solid var(--sand);font-size:.85rem;opacity:.7}
</style></head><body><main>

<header class="top"><div><h1>Ranna brand guide</h1><p>Mark, wordmark, colour, type and spacing for Ranna, the QR-ordering platform that rings your phone when the order is ready. Every file here is generated by <code>npm run build</code> in <code>/brand</code>.</p></div>
${img(tile("ochre", "L"), "width:96px;height:96px")}</header>

<div class="hero"><div class="panel" style="display:flex;align-items:center;justify-content:center;min-height:300px">${img(hero.svg, "max-width:520px;width:100%")}</div>
<div class="panel" style="background:${C.ochre};display:flex;align-items:center;justify-content:center">${img(heroStack.svg, "width:200px")}</div></div>

<section id="mark"><h2><span>01</span>The mark</h2><p class="lede">A service cloche with ring arcs: the order is ready, and the phone rings. It is built on a 200-unit grid. One unit does all the spacing: <b>K, the diameter of the handle (18 grid units)</b>. The mark is exactly <b>7K tall</b>.</p>
<div class="row two"><div class="panel">${img(construction, "width:100%")}</div>
<div><ul class="rules"><li><b>Dome</b> carries the colour. Its gloss is a true knock-out, so the mark stays correct on any ground.</li><li><b>Rim and plate line</b> share the fired clay in the colour version; the plate line drops out below 64 px.</li><li><b>Ring arcs</b>: two per side at full size, one per side at M, none at S.</li><li>Tile corner radius is <b>22% of the edge</b> (44 / 200).</li></ul>
<p style="margin-top:18px"><b>Mark-only files</b> (no tile) are cropped tight to the artwork, ready to place with the clear space below.</p></div></div>
<div class="row" style="margin-top:20px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${markWays}</div></section>

<section id="space"><h2><span>02</span>Clear space and spacing</h2><p class="lede">Keep <b>2K</b> clear on every side of any logo. Inside the lockups everything is set from the same unit, so scaling a lockup never changes its proportions. Never rebuild one by eye.</p>
<div class="row two"><div class="panel">${img(clearSpace, "width:100%")}<p style="margin:12px 4px 0;font-size:.85rem">Clear space = 2K on all sides, measured from the artwork edge. On a tile or a photo, the tile or photo edge counts as the artwork edge.</p></div>
<div class="panel">${img(spacing, "width:100%")}<p style="margin:12px 4px 0;font-size:.85rem">The wordmark sits on the rim's lower edge (shared baseline). Mark to word gap 2K (stacked: 1.5K). Bilingual pair: 1.5K either side of a ${SPEC.divider}-unit divider.</p></div></div>
<table style="margin-top:24px"><thead><tr><th>Measure</th><th>Value</th><th>Note</th></tr></thead><tbody>
<tr><td>Mark height H</td><td class="num">7K = 126 units</td><td>Artwork bounds, plate line included.</td></tr>
<tr><td>Clear space</td><td class="num">2K</td><td>All four sides.</td></tr>
<tr><td>Wordmark x-height</td><td class="num">${SPEC.xhH} H, stacked ${SPEC.xhStack} H</td><td>Latin font size = x-height / ${XH}.</td></tr>
<tr><td>Arabic size</td><td class="num">${SPEC.arScale} x Latin</td><td>Alexandria Arabic reads optically smaller; this equalises the pair.</td></tr>
<tr><td>Gaps</td><td class="num">2K, 1.5K, 1.5K</td><td>Horizontal mark to word, stacked, pair divider.</td></tr></tbody></table></section>

<section id="size"><h2><span>03</span>Sizes and optical versions</h2><p class="lede">Detail that works at 200 px turns to mud at 24 px, so the mark comes in three optical sizes. Pick by rendered size, never by file.</p>
<div class="row three">${opticRow}</div>
<table style="margin-top:28px"><thead><tr><th>Logo</th><th>Minimum (screen)</th><th>Print</th><th>Below it</th></tr></thead><tbody>${minTable}</tbody></table></section>

<section id="colour"><h2><span>04</span>Colour</h2><p class="lede">The brand palette is the product palette: these are the <code>DESIGN.md</code> tokens (red-ochre, fired-clay, clay-slip, slip-white, manganese-ink, hairline), converted from oklch to hex by the generator, so the logo cannot drift from the UI. Red Ochre is ${ratio(C.ochre, C.paper).toFixed(1)} : 1 on paper, so it also works for text and buttons.</p>
<div class="row three">${swatches}</div>
<h3 style="margin:36px 0 10px;font-size:1.15rem">Pairings (WCAG 2.2 contrast)</h3>
<table><thead><tr><th>Foreground</th><th>Ground</th><th>Contrast</th><th>Use</th></tr></thead><tbody>${contrast}</tbody></table>
<p class="lede" style="margin-top:14px;font-size:.85rem">Rough balance on a page: Slip White 60, Clay Slip 15, Red Ochre 15, Fired Clay 7, Ink 3. State colours (cobalt, amber, enamel green, oxblood) stay UI-only and never appear in the logo.</p></section>

<section id="ways"><h2><span>05</span>Colourways</h2><p class="lede">Six colourways, all transparent SVG. <b>Colour</b> on slip white or clay slip, <b>On dark</b> on fired clay or ink, <b>Reverse</b> on red ochre, and a one-colour version when you only have one ink.</p>
<div class="row three">${way("color", C.paper, C.ink)}${way("color", C.slip, C.ink)}${way("dark", C.clay, C.slip)}${way("dark", C.ink, C.slip)}${way("reverse", C.ochre, C.slip)}${way("reverse", C.clay, C.slip)}${way("ink", C.paper, C.ink)}${way("clay", C.slip, C.ink)}${way("ochre", C.paper, C.ink)}</div></section>

<section id="type"><h2><span>06</span>Typography</h2><p class="lede">The wordmark is <b>Alexandria Bold</b>, lowercase, default kerning, converted to outlines so no font is needed to use it. Latin and Arabic come from one family, which is why the pair sits so evenly. Arabic is written <b>رنة</b> without vowel marks.</p>
<div class="type">
<div class="spec"><small>Wordmark, Alexandria 700</small><div class="big" style="font-family:Alexandria;color:var(--clay)">ranna</div><div class="big ar" style="color:var(--clay)">رنة</div><small>Outlined in <code>wordmark-*.svg</code>. Do not retype it.</small></div>
<div class="spec"><small>Headings, Alexandria 700</small><h3 style="font-size:2rem;margin:8px 0">Your order is ready</h3><h3 class="ar" style="font-size:2rem;margin:8px 0">طلبك جاهز</h3><small>Latin and Arabic, tracking -0.01em, line-height 1.15.</small></div>
<div class="spec"><small>Interface and body</small><p style="font:400 1.05rem/1.5 Inter;margin:8px 0">Inter 400 / 600 for Latin text: "Table 12, 2 items, 1,450 DZD".</p><p class="cairo" style="font:400 1.1rem/1.7 Cairo;margin:8px 0">كايرو للنص العربي</p><small>The same faces the product already ships (<code>src/app/fonts.ts</code>).</small></div></div></section>

<section id="lockups"><h2><span>07</span>Lockup library</h2><p class="lede">Nine arrangements. Horizontal for headers and bars, stacked for squares and signage, Arabic and bilingual versions for RTL surfaces. In the Arabic horizontal lockup the mark sits on the <b>right</b>, where an Arabic reader starts.</p>
<div class="row three">${lib}</div><h3 style="margin:32px 0 12px;font-size:1.15rem">Tiles</h3><div class="row four">${tiles}</div></section>

<section id="icons"><h2><span>08</span>App icons and social</h2><p class="lede">The ochre tile is the app icon. Rounded where we draw the corner (favicon, 192, 512), full-bleed where the OS rounds it (Apple touch icon, maskable). The maskable mark is held inside the 80% safe circle. Nothing here replaces <code>public/icons</code> until you copy it across.</p>
<div class="row four"><figure class="lib"><div class="stage">${img(tile("ochre", "L"), "width:140px")}</div><figcaption><code>icon-192/512.png</code></figcaption></figure><figure class="lib"><div class="stage">${img(tile("ochre", "L", { bleed: true, scale: 0.78 }), "width:140px;border-radius:50%")}</div><figcaption><code>maskable-192/512.png</code> (circle mask preview)</figcaption></figure><figure class="lib"><div class="stage">${img(tile("ochre", "M"), "width:48px")}${img(tile("ochre", "S"), "width:32px;margin-left:14px")}${img(tile("ochre", "S"), "width:16px;margin-left:14px")}</div><figcaption><code>favicon.ico</code> 48, 32, 16 and <code>favicon.svg</code></figcaption></figure><figure class="lib"><div class="stage">${img(tile("ochre", "L", { bleed: true, scale: 0.7 }), "width:120px;border-radius:50%")}</div><figcaption><code>social/avatar-1024.png</code>, <code>og-1200x630.png</code></figcaption></figure></div></section>

<section id="dont"><h2><span>09</span>Don't</h2><p class="lede">If you need something these files don't cover, add it to the generator instead of editing a copy.</p><div class="row three">${mis}</div></section>

<footer>Source of truth: <code>brand/lib.mjs</code> (geometry, colour), <code>brand/lockups.mjs</code> (spacing), <code>brand/tokens.json</code>, <code>brand/brand.css</code>. Fonts are SIL OFL, from Fontsource.</footer>
</main></body></html>`;
  writeFileSync("index.html", html);

  writeFileSync(
    "tokens.json",
    JSON.stringify(
      {
        color: Object.fromEntries(COLORS.map((c) => [c.token, { value: c.hex, role: c.role }])),
        contrast: Object.fromEntries(pairs.map(([a, ah, b, bh]) => [`${a} on ${b}`, +ratio(ah, bh).toFixed(2)])),
        type: { wordmark: "Alexandria 700, lowercase, outlined", arabic: "رنة (no vowel marks)", ui: ["Inter", "Cairo"], heading: "Alexandria" },
        space: { unitK: K, markHeightK: 7, clearSpaceK: 2, gapHorizontalK: 2, gapStackedK: 1.5, tileRadiusRatio: 0.22 },
        minSize: { tilePx: 64, markPx: MARK_MIN, opticBreaks: { L: 64, M: 40, S: 16 } },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    "brand.css",
    `/* Ranna brand tokens. Generated by brand/build.mjs; do not edit. */\n:root {\n${COLORS.map((c) => `  --ranna-${c.token}: ${c.hex};`).join("\n")}\n  --ranna-unit: 18; /* K: handle diameter in grid units; clear space = 2K */\n}\n`,
  );
}
