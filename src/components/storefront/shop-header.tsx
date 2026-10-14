import { cn } from "@/lib/utils";

export type ShopStatusTone = "open" | "paused" | "closed";

/**
 * The header band: the screen's brand plate. Brand fill (or the cover photo under a scrim)
 * carries the logo, the shop name and whether it is taking orders right now.
 */
export function ShopHeader({
  name,
  logoUrl,
  coverUrl,
  status,
  welcome,
}: {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: { label: string; tone: ShopStatusTone };
  welcome: string | null;
}) {
  const onPhoto = Boolean(coverUrl);
  return (
    <>
      <header
        className={cn(
          "relative isolate overflow-hidden",
          onPhoto ? "bg-[#1f1a17] text-white" : "bg-[var(--brand)] text-[var(--brand-contrast)]",
        )}
      >
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- LCP image, sized by CSS, already WebP */}
            <img
              src={coverUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 -z-20 size-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.78),rgb(0_0_0/0.35)_55%,rgb(0_0_0/0.12))]"
            />
          </>
        ) : null}
        <div className="mx-auto flex min-h-48 max-w-2xl flex-col justify-end gap-3 px-4 pt-8 pb-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- small, already resized on upload
            <img
              src={logoUrl}
              alt=""
              width={64}
              height={64}
              className="size-16 rounded-full bg-white object-cover shadow-[0_6px_18px_-8px_rgb(0_0_0/0.5)] ring-2 ring-white/80"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-16 place-items-center rounded-full bg-[var(--brand-2)] text-2xl font-bold text-[var(--brand-2-contrast)] ring-2 ring-white/70"
            >
              {Array.from(name)[0]}
            </span>
          )}
          <h1 className="text-[1.875rem] leading-[1.1] font-bold text-balance">{name}</h1>
          <p
            className={cn(
              "inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-semibold",
              onPhoto
                ? "bg-white/18"
                : "bg-[color-mix(in_srgb,var(--brand-contrast)_14%,transparent)]",
            )}
            role="status"
          >
            <span
              aria-hidden
              className={cn(
                "size-2 rotate-45 rounded-[1px]",
                status.tone === "open"
                  ? "bg-[#3ddc97]"
                  : status.tone === "paused"
                    ? "bg-[#ffc857]"
                    : "bg-current opacity-60",
              )}
            />
            {status.label}
          </p>
        </div>
      </header>
      {welcome ? (
        <p className="mx-auto max-w-2xl px-4 pt-4 text-[0.9375rem] leading-relaxed text-[var(--shop-muted)]">
          {welcome}
        </p>
      ) : null}
    </>
  );
}
