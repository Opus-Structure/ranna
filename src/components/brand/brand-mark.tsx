import type { CSSProperties } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { LOCKUP, MARK, WORDMARK } from "./logo-data";

/*
 * Ranna logo: a service cloche with ring arcs (the order is ready, the phone rings).
 * Geometry and spacing rules live in /brand (see brand/index.html); logo-data.ts is generated
 * from them. Colour comes from the surrounding text colour, so the mark works on every ground.
 */

/** L: full mark (≥ 54 px wide). M: one arc per side (40–53 px). S: dome, handle, rim (< 40 px). */
export type MarkOptic = keyof typeof MARK;

export function BrandMark({
  className,
  title,
  optic = "L",
  duo = false,
}: {
  className?: string;
  title?: string;
  optic?: MarkOptic;
  /** Dome in the action colour (ochre), rim and plate line in fired clay by day. */
  duo?: boolean;
}) {
  const m = MARK[optic];
  const style = duo ? ({ "--brand-rim": "var(--brand-rim-duo)", "--brand-dome": "var(--primary)" } as CSSProperties) : undefined;
  return (
    <svg
      viewBox={m.viewBox}
      className={cn("h-8 w-auto shrink-0", className)}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      dangerouslySetInnerHTML={{ __html: m.inner }}
    />
  );
}

/** Outlined wordmark (Alexandria Bold): "ranna | رنة" by default. Size it with a height class. */
export function Wordmark({
  className,
  variant = "pair",
}: {
  className?: string;
  variant?: keyof typeof WORDMARK;
}) {
  const w = WORDMARK[variant];
  return (
    <svg
      viewBox={`0 0 ${w.w} ${w.h}`}
      className={cn("h-6 w-auto shrink-0", className)}
      role="img"
      aria-label={`${brand.name} ${brand.nameAr}`}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: w.inner }}
    />
  );
}

/**
 * The horizontal lockup: mark + wordmark on the shared baseline, spaced per the brand rules.
 * Use h-10 or larger so the full mark stays legible. Everything takes the text colour; with `duo` the dome is
 * ochre and the rim and plate line fired clay, on light grounds.
 */
export function Logo({
  className,
  variant = "bilingual",
  duo = false,
}: {
  className?: string;
  variant?: keyof typeof LOCKUP;
  duo?: boolean;
}) {
  const l = LOCKUP[variant];
  const style = duo ? ({ "--brand-rim": "var(--brand-rim-duo)", "--brand-dome": "var(--primary)" } as CSSProperties) : undefined;
  return (
    <svg
      viewBox={`0 0 ${l.w} ${l.h}`}
      className={cn("h-10 w-auto shrink-0", className)}
      style={style}
      role="img"
      aria-label={`${brand.name} ${brand.nameAr}`}
      fill="none"
      dangerouslySetInnerHTML={{ __html: l.inner }}
    />
  );
}
