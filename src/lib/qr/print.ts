import type { AppLocale } from "@/i18n/routing";
import { qrMatrix } from "./matrix";

/*
 * Printable QR artwork, built entirely in the browser. Each card is painted on a 300 dpi canvas
 * (the browser shapes Arabic and uses the merchant's own font), then pdf-lib places the images
 * on A4 pages. No server-side Chromium, nothing uploaded.
 */

export type PrintTexts = { locale: AppLocale; scan: string; noApp: string };
export type PrintCard = { url: string; tableLabel?: string };
export type PrintSpec = {
  shopName: string;
  logoUrl: string | null;
  primary: string;
  primaryContrast: string;
  ink: string;
  accent: string;
  accentContrast: string;
  fontFamily: string;
  /** Main language first; every shop language gets its "Scan to order" line. */
  texts: PrintTexts[];
};

const MM = 300 / 25.4; // pixels per millimetre at 300 dpi
const A4 = { w: 595.28, h: 841.89 }; // points

const isRtl = (text: string) => /[֐-ࣿ]/.test(text);

export async function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Resolves the CSS family behind a next/font class and waits until its glyphs are ready. */
export async function resolveFontFamily(fontClass: string): Promise<string> {
  const probe = document.createElement("span");
  probe.className = fontClass;
  probe.textContent = "أبجد Aa";
  probe.style.cssText = "position:absolute;visibility:hidden;font-weight:700";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  await Promise.all([
    document.fonts.load(`700 64px ${family}`, "أبجد Aa 0123"),
    document.fonts.load(`400 64px ${family}`, "أبجد Aa 0123"),
  ]).catch(() => undefined);
  return family;
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  family: string,
  maxWidth: number,
) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { weight: number; size: number; family: string; color: string; maxWidth: number },
) {
  const size = fitText(ctx, text, opts.weight, opts.size, opts.family, opts.maxWidth);
  ctx.fillStyle = opts.color;
  ctx.direction = isRtl(text) ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  return size;
}

function drawQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  side: number,
  color: string,
) {
  const m = qrMatrix(url);
  const quiet = 4;
  const cell = Math.floor(side / (m.size + quiet * 2));
  const drawn = cell * (m.size + quiet * 2);
  const ox = Math.round(x + (side - drawn) / 2);
  const oy = Math.round(y + (side - drawn) / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(ox, oy, drawn, drawn);
  ctx.fillStyle = color;
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (m.dark(c, r)) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
    }
  }
}

/** The platform's lattice band: a row of 45° lozenges between two hairlines. */
function drawBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
  unit: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, Math.max(1, unit * 0.12));
  ctx.fillRect(x, y + unit, width, Math.max(1, unit * 0.12));
  const count = Math.floor(width / unit);
  const start = x + (width - count * unit) / 2;
  for (let i = 0; i < count; i++) {
    const cx = start + i * unit + unit / 2;
    const cy = y + unit / 2;
    const r = unit * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  spec: PrintSpec,
  logo: HTMLImageElement | null,
  w: number,
  bandH: number,
) {
  ctx.fillStyle = spec.primary;
  ctx.fillRect(0, 0, w, bandH);
  const logoSize = bandH * 0.42;
  let nameY = bandH * 0.62;
  if (logo) {
    const lx = w / 2 - logoSize / 2;
    const ly = bandH * 0.12;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, lx, ly, logoSize, logoSize);
    ctx.restore();
    nameY = ly + logoSize + bandH * 0.26;
  }
  drawText(ctx, spec.shopName, w / 2, Math.min(nameY, bandH * 0.9), {
    weight: 700,
    size: bandH * (logo ? 0.2 : 0.3),
    family: spec.fontFamily,
    color: spec.primaryContrast,
    maxWidth: w * 0.86,
  });
}

/** Paints one card. Portrait cards stack everything; landscape cards set QR and text side by side. */
export function paintCard(
  canvas: HTMLCanvasElement,
  spec: PrintSpec,
  card: PrintCard,
  logo: HTMLImageElement | null,
) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const landscape = w > h;
  const bandH = h * (landscape ? 0.22 : 0.2);
  drawHeader(ctx, spec, logo, w, bandH);
  const unit = Math.round(w * (landscape ? 0.012 : 0.022));
  drawBand(ctx, w * 0.08, bandH + unit * 1.2, w * 0.84, spec.ink, unit);

  const [main, ...others] = spec.texts;
  const textLines = (cx: number, top: number, maxWidth: number, scale: number) => {
    let y = top;
    if (main) {
      const s = drawText(ctx, main.scan, cx, y, {
        weight: 800,
        size: 96 * scale,
        family: spec.fontFamily,
        color: spec.ink,
        maxWidth,
      });
      y += s * 1.15;
    }
    for (const o of others) {
      const s = drawText(ctx, o.scan, cx, y, {
        weight: 700,
        size: 60 * scale,
        family: spec.fontFamily,
        color: spec.ink,
        maxWidth,
      });
      y += s * 1.25;
    }
    if (main) {
      y += 14 * scale;
      const s = drawText(ctx, main.noApp, cx, y, {
        weight: 400,
        size: 42 * scale,
        family: spec.fontFamily,
        color: "#5a534e",
        maxWidth,
      });
      y += s * 1.4;
    }
    return y;
  };

  const tableLabel = card.tableLabel;
  if (landscape) {
    const contentTop = bandH + unit * 3.2;
    const side = Math.min(h - contentTop - h * 0.07, w * 0.42);
    const rtl = main ? isRtl(main.scan) : false;
    const qrX = rtl ? w * 0.06 : w - w * 0.06 - side;
    drawQr(ctx, card.url, qrX, contentTop, side, "#000000");
    const textCx = rtl
      ? w * 0.06 + side + (w - side - w * 0.12) / 2
      : w * 0.06 + (w - side - w * 0.12) / 2;
    const textWidth = w - side - w * 0.18;
    let y = contentTop + side * 0.32;
    y = textLines(textCx, y, textWidth, w / 2480);
    if (tableLabel) pill(ctx, tableLabel, textCx, y + 30 * (w / 2480), spec, w / 2480);
  } else {
    const side = w * 0.64;
    const qrTop = bandH + unit * 3;
    drawQr(ctx, card.url, (w - side) / 2, qrTop, side, "#000000");
    let y = qrTop + side + h * 0.06;
    y = textLines(w / 2, y, w * 0.86, w / 1240);
    if (tableLabel) pill(ctx, tableLabel, w / 2, y + 10, spec, w / 1240);
  }
  // The address, for anyone whose camera won't read the code.
  drawText(ctx, card.url.replace(/^https?:\/\//, ""), w / 2, h - h * 0.025, {
    weight: 400,
    size: Math.round(w * (landscape ? 0.013 : 0.024)),
    family: spec.fontFamily,
    color: "#7a726c",
    maxWidth: w * 0.9,
  });
}

function pill(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  top: number,
  spec: PrintSpec,
  scale: number,
) {
  const size = 54 * scale;
  ctx.font = `800 ${size}px ${spec.fontFamily}`;
  const textW = ctx.measureText(label).width;
  const padX = size * 0.8;
  const height = size * 1.7;
  const width = textW + padX * 2;
  const x = cx - width / 2;
  ctx.fillStyle = spec.accent;
  ctx.beginPath();
  ctx.roundRect(x, top, width, height, height / 2);
  ctx.fill();
  drawText(ctx, label, cx, top + height * 0.68, {
    weight: 800,
    size,
    family: spec.fontFamily,
    color: spec.accentContrast,
    maxWidth: width,
  });
}

async function cardPng(
  spec: PrintSpec,
  card: PrintCard,
  wMm: number,
  hMm: number,
  logo: HTMLImageElement | null,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(wMm * MM);
  canvas.height = Math.round(hMm * MM);
  paintCard(canvas, spec, card, logo);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("canvas export failed");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * A4 table tent: fold along the dashed line. The top half is printed upside down so both
 * faces read correctly once the sheet stands as a tent.
 */
export async function buildTentPdf(spec: PrintSpec, card: PrintCard): Promise<Blob> {
  const { PDFDocument, degrees, rgb } = await import("pdf-lib");
  const logo = await loadImage(spec.logoUrl);
  const png = await cardPng(spec, card, 210, 148.5, logo);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${spec.shopName} · QR`);
  const page = pdf.addPage([A4.w, A4.h]);
  const img = await pdf.embedPng(png);
  const half = A4.h / 2;
  page.drawImage(img, { x: 0, y: 0, width: A4.w, height: half });
  page.drawImage(img, { x: A4.w, y: A4.h, width: A4.w, height: half, rotate: degrees(180) });
  page.drawLine({
    start: { x: 0, y: half },
    end: { x: A4.w, y: half },
    thickness: 0.6,
    color: rgb(0.6, 0.6, 0.6),
    dashArray: [4, 4],
  });
  return new Blob([Uint8Array.from(await pdf.save()).buffer], { type: "application/pdf" });
}

/** A4 sheets of four A6 cards (cut along the guides), one card per QR code. */
export async function buildSheetPdf(spec: PrintSpec, cards: PrintCard[]): Promise<Blob> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const logo = await loadImage(spec.logoUrl);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${spec.shopName} · QR`);
  const cw = A4.w / 2;
  const ch = A4.h / 2;
  for (let i = 0; i < cards.length; i += 4) {
    const page = pdf.addPage([A4.w, A4.h]);
    const batch = cards.slice(i, i + 4);
    for (const [j, card] of batch.entries()) {
      const img = await pdf.embedPng(await cardPng(spec, card, 105, 148.5, logo));
      page.drawImage(img, {
        x: (j % 2) * cw,
        y: A4.h - (Math.floor(j / 2) + 1) * ch,
        width: cw,
        height: ch,
      });
    }
    const guide = { thickness: 0.5, color: rgb(0.7, 0.7, 0.7), dashArray: [3, 3] };
    page.drawLine({ start: { x: cw, y: 0 }, end: { x: cw, y: A4.h }, ...guide });
    page.drawLine({ start: { x: 0, y: ch }, end: { x: A4.w, y: ch }, ...guide });
  }
  return new Blob([Uint8Array.from(await pdf.save()).buffer], { type: "application/pdf" });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
