"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 50,
  size = "md",
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  label: string;
}) {
  const t = useTranslations("order");
  const btn = cn(
    "grid place-items-center rounded-full border border-[var(--shop-line)] bg-[var(--shop-card)] transition-colors",
    "hover:border-[var(--brand-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
    "disabled:opacity-40",
    size === "md" ? "size-11" : "size-9",
  );
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <button
        type="button"
        className={btn}
        aria-label={t("decrease")}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-7 text-center font-bold tabular-nums",
          size === "md" ? "text-lg" : "text-base",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={t("increase")}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
