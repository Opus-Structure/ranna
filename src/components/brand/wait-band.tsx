import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The wait band (signature move): a hairline lattice band that inks one lozenge per minute an
 * order has waited, toward the shop's prep target, and turns ochre once the target is passed.
 * Lozenges are real 45° squares laid out with flex, so they stay square at any width and the
 * band fills from the reading start (right in Arabic, left in French/English).
 */
export function WaitBand({
  elapsedMinutes,
  targetMinutes,
  label,
  className,
}: {
  elapsedMinutes: number;
  targetMinutes: number;
  /** Accessible description, e.g. "Waiting 7 of 10 minutes". Omit when purely decorative. */
  label?: string;
  className?: string;
}) {
  const target = Math.max(1, Math.round(targetMinutes));
  const cells = Math.min(16, Math.max(target + 2, 8));
  const elapsed = Math.max(0, Math.floor(elapsedMinutes));
  const late = elapsed > target;
  const rule = "color-mix(in oklch, var(--band-ink) 45%, transparent)";

  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-late={late || undefined}
      className={cn("relative flex h-3.5 items-center justify-between px-[3px]", className)}
      style={{ borderBlock: `1px solid ${rule}` } as CSSProperties}
    >
      {Array.from({ length: cells }, (_, i) => {
        const inked = i < elapsed;
        const color = !inked
          ? undefined
          : i >= target || late
            ? "var(--band-late)"
            : "var(--band-ink)";
        return (
          <span
            key={i}
            className="size-[6px] shrink-0 rotate-45 rounded-[0.5px] border"
            style={{
              backgroundColor: color ?? "transparent",
              borderColor: color ?? "var(--band-empty)",
            }}
          />
        );
      })}
      {target < cells ? (
        <span
          aria-hidden
          className="absolute -inset-y-[3px] w-[1.5px]"
          style={{
            // Midway between the last on-time lozenge and the first late one
            // (centres sit at 3px padding + 3px half-size, spread by justify-between).
            insetInlineStart: `calc(6px + (100% - 12px) * ${(target - 0.5) / (cells - 1)} - 0.75px)`,
            backgroundColor: "var(--band-late)",
          }}
        />
      ) : null}
    </div>
  );
}
