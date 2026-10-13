import { cn } from "@/lib/utils";

/**
 * Ranna mark: a lozenge ringing outward on the 45° lattice, two outlines around a solid core,
 * like a chime's ripple painted in the Kabyle line style.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      <path d="M16 2 30 16 16 30 2 16Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8 24 16 16 24 8 16Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 12.5 19.5 16 16 19.5 12.5 16Z" fill="currentColor" />
    </svg>
  );
}

/** Wordmark: the Arabic name leads, the Latin name follows, in both directions. */
export function Wordmark({
  className,
  ar,
  latin,
}: {
  className?: string;
  ar: string;
  latin: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-display text-xl leading-none font-bold" lang="ar" dir="rtl">
        {ar}
      </span>
      <span
        className="font-display text-xs leading-none font-medium tracking-wide opacity-75"
        lang="en"
        dir="ltr"
      >
        {latin}
      </span>
    </span>
  );
}
