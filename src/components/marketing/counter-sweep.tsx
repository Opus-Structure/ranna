"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Shouted numbers on the crowded side: position (% from the reading start), size, tilt. */
const shouted: { n: number; x: number; y: number; s: number; r: number; wide?: boolean }[] = [
  { n: 112, x: 3, y: 10, s: 5.5, r: -8 },
  { n: 107, x: 13, y: 34, s: 7, r: 6 },
  { n: 115, x: 45, y: 60, s: 3.2, r: -4, wide: true },
  { n: 109, x: 27, y: 14, s: 3.6, r: 11 },
  { n: 118, x: 31, y: 52, s: 4.6, r: -12 },
  { n: 104, x: 40, y: 20, s: 6.2, r: 4 },
  { n: 111, x: 52, y: 66, s: 3.4, r: 9 },
  { n: 106, x: 57, y: 12, s: 4.2, r: -6 },
  { n: 113, x: 66, y: 46, s: 5.8, r: 7 },
  { n: 101, x: 74, y: 8, s: 3, r: -10, wide: true },
  { n: 116, x: 80, y: 70, s: 4.4, r: 5 },
  { n: 108, x: 87, y: 30, s: 6.4, r: -5 },
  { n: 103, x: 94, y: 62, s: 3.2, r: 12, wide: true },
];

/** The calm side: customers' phones, each holding its own number. One of them is ringing. */
const phones = [
  { n: 104, x: 5, stage: "preparing" },
  { n: 107, x: 24, stage: "received" },
  { n: 108, x: 43, stage: "preparing" },
  { n: 112, x: 62, stage: "ready" },
  { n: 113, x: 81, stage: "received" },
] as const;

/**
 * The landing's counter band: one scene the visitor sweeps from the crowded "before" (shouted
 * numbers, pagers walking off) to the calm "after" (each customer holding a numbered phone, one
 * ringing in the reserved enamel green). The handle is a real range input: drag, click or use
 * the arrow keys. The before side never sits still; the after side is dead calm but for the ring.
 */
export function CounterSweep() {
  const t = useTranslations("site.counter");
  const [split, setSplit] = useState(50);
  const touched = useRef(false);

  // One authored entrance: the calm sweeps in from the far end, then hands over control.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const from = 88;
    const to = 50;
    const step = (now: number) => {
      if (touched.current) return;
      const p = Math.min(1, (now - start) / 1400);
      const eased = 1 - Math.pow(1 - p, 4);
      setSplit(from + (to - from) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    setSplit(from);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const style = { "--split": `${split}%` } as CSSProperties;

  return (
    <>
      <section
        aria-labelledby="counter-title"
        className="relative isolate h-[17rem] w-full overflow-hidden border-y-[3px] border-foreground select-none sm:h-[clamp(24rem,46vh,26.5rem)]"
        style={style}
      >
        <h2 id="counter-title" className="sr-only">
          {t("title")}
        </h2>

        {/* Before: the crowded counter. */}
        <div className="absolute inset-0 bg-clay text-clay-foreground">
          <div aria-hidden className="absolute inset-0">
            {shouted.map((s, i) => (
              <span
                key={s.n}
                className={cn(
                  "absolute order-number leading-none motion-safe:animate-[restless_3.2s_ease-in-out_infinite]",
                  // A few small ones only where there is room for them.
                  s.wide && "max-sm:hidden",
                )}
                style={
                  {
                    insetInlineStart: `${s.x}%`,
                    top: `${s.y}%`,
                    fontSize: `clamp(${s.s * 0.42}rem, ${s.s * 1.1}vw, ${s.s}rem)`,
                    "--tilt": `${s.r}deg`,
                    rotate: `${s.r}deg`,
                    animationDelay: `${-i * 0.37}s`,
                    opacity: i % 3 === 0 ? 0.55 : 0.92,
                  } as CSSProperties
                }
              >
                {s.n}
              </span>
            ))}
            <Pager className="absolute start-[4%] top-[52%] size-14 rotate-[-14deg] opacity-80 max-sm:start-[46%] max-sm:top-[56%] max-sm:size-10" />
            <Pager className="absolute start-[71%] top-[74%] size-11 rotate-[18deg] opacity-70" />
            <span className="absolute inset-x-0 bottom-3 lattice text-clay-foreground" />
          </div>
          <p className="absolute start-8 bottom-11 max-w-[min(22rem,44%)] text-sm leading-snug max-sm:hidden">
            <strong className="block font-display text-base">{t("before.title")}</strong>
            {t("before.body")}
          </p>
        </div>

        {/* After: the same customers, waiting anywhere, each phone holding its number. */}
        <div className="absolute inset-0 bg-[color-mix(in_oklch,var(--background)_62%,var(--clay-muted))] text-foreground [clip-path:inset(0_0_0_var(--split))] rtl:[clip-path:inset(0_var(--split)_0_0)]">
          <span aria-hidden className="absolute inset-x-0 bottom-3 lattice text-foreground" />
          <ul aria-label={t("phones")} className="absolute inset-x-0 top-[7%] h-[60%] sm:top-[12%]">
            {phones.map((p) => (
              <li key={p.n} className="absolute top-0" style={{ insetInlineStart: `${p.x}%` }}>
                <PhoneTicket
                  number={p.n}
                  stage={p.stage}
                  label={t(`stage.${p.stage}`)}
                  yourNumber={t("yourNumber")}
                />
              </li>
            ))}
          </ul>
          <p className="absolute end-8 bottom-11 max-w-[min(22rem,44%)] text-sm leading-snug max-sm:hidden">
            <strong className="block font-display text-base">{t("after.title")}</strong>
            {t("after.body")}
          </p>
        </div>

        {/* The divider and its lozenge handle (drawn); the range input below does the work. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-foreground rtl:translate-x-1/2"
          style={{ insetInlineStart: "var(--split)" }}
        >
          <span className="absolute bottom-6 left-1/2 grid size-12 -translate-x-1/2 translate-y-1/2 rotate-45 place-items-center rounded-md bg-foreground text-background shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)]">
            <span className="flex -rotate-45">
              <ChevronLeft className="size-4" />
              <ChevronRight className="size-4" />
            </span>
          </span>
        </div>
        <input
          type="range"
          min={4}
          max={96}
          step={1}
          value={Math.round(split)}
          onChange={(e) => {
            touched.current = true;
            setSplit(Number(e.target.value));
          }}
          onPointerDown={() => (touched.current = true)}
          aria-label={t("slider")}
          aria-valuetext={t("sliderValue", { calm: 100 - Math.round(split) })}
          className="counter-range absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />
      </section>
      {/* Phones: the captions read below the band, before at the reading start, so the scene stays clear. */}
      <div className="grid grid-cols-2 gap-4 px-4 pt-3 pb-1 text-sm leading-snug sm:hidden">
        <p>
          <strong className="block font-display">{t("before.title")}</strong>
          {t("before.body")}
        </p>
        <p>
          <strong className="block font-display">{t("after.title")}</strong>
          {t("after.body")}
        </p>
      </div>
    </>
  );
}

function PhoneTicket({
  number,
  stage,
  label,
  yourNumber,
}: {
  number: number;
  stage: "received" | "preparing" | "ready";
  label: string;
  yourNumber: string;
}) {
  const ready = stage === "ready";
  return (
    <div
      className={cn(
        "flex aspect-[10/17] w-[clamp(4.4rem,14vw,8rem)] flex-col items-center justify-center gap-1 rounded-[clamp(0.9rem,2vw,1.6rem)] border-[3px] border-foreground px-1.5 text-center sm:gap-1.5",
        ready
          ? "ready-halo bg-state-ready text-state-ready-foreground"
          : "bg-card shadow-[0_14px_30px_-20px_rgb(31_26_23/0.5)]",
      )}
    >
      <span
        className={cn(
          "text-[0.5rem] font-semibold whitespace-nowrap sm:text-[0.62rem]",
          ready ? "opacity-90" : "text-muted-foreground",
        )}
      >
        {yourNumber}
      </span>
      <span className="order-number text-[clamp(1.15rem,5vw,2.8rem)]">{number}</span>
      <span className="flex items-center gap-1 text-[0.55rem] font-semibold sm:gap-1.5 sm:text-[0.68rem]">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rotate-45 rounded-[1px]",
            ready ? "bg-current" : stage === "preparing" ? "bg-state-preparing" : "bg-state-new",
          )}
        />
        {label}
      </span>
    </div>
  );
}

/** A restaurant pager, struck through: the thing that walks out of the shop. */
function Pager({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <rect x="10" y="6" width="28" height="36" rx="7" />
      <rect x="16" y="12" width="16" height="10" rx="2" />
      <circle cx="24" cy="32" r="3" />
      <path d="M4 44 44 4" />
    </svg>
  );
}
