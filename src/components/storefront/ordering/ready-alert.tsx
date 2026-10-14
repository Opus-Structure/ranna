"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { startAlarm, unlockAlarm } from "@/lib/orders/alerts";

/**
 * The ring: when the order turns ready (or staff ring again) the page is taken over by the
 * reserved enamel green with the number, a looping alarm and vibration, until the customer
 * taps "Got it, I'm coming". The flash is skipped under reduced motion; the alarm stops by
 * itself after three minutes.
 */
export function ReadyAlert({
  number,
  active,
  ringAt,
  onAcknowledge,
}: {
  number: number;
  active: boolean;
  /** Changes when staff ring again: restarts the alarm. */
  ringAt: string | null;
  onAcknowledge: () => void;
}) {
  const t = useTranslations("order.alerts.ready");
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!active) return;
    const stop = startAlarm();
    const base = document.title;
    document.title = `🔔 ${t("tabTitle", { number })}`;
    button.current?.focus();
    // Any tap unlocks audio for browsers that blocked it until now.
    const unlock = () => void unlockAlarm();
    window.addEventListener("pointerdown", unlock);
    return () => {
      stop();
      document.title = base;
      window.removeEventListener("pointerdown", unlock);
    };
  }, [active, ringAt, number, t]);

  if (!active) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ready-alert-title"
      aria-describedby="ready-alert-body"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-state-ready px-6 text-center text-state-ready-foreground motion-safe:animate-[ready-flash_1.2s_steps(2,jump-none)_infinite]"
    >
      <span aria-hidden className="band-rule w-40 opacity-70" />
      <h2 id="ready-alert-title" className="text-3xl font-bold text-balance">
        {t("title")}
      </h2>
      <p
        className="order-number text-[clamp(7rem,40vw,12rem)]"
        aria-label={t("numberLabel", { number })}
      >
        {number}
      </p>
      <p id="ready-alert-body" className="max-w-xs text-lg text-pretty opacity-90">
        {t("body")}
      </p>
      <button
        ref={button}
        type="button"
        onClick={onAcknowledge}
        className="mt-2 flex h-16 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-white text-lg font-bold text-[#123d2a] shadow-[0_12px_30px_-12px_rgb(0_0_0/0.45)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.99]"
      >
        <Check className="size-6" aria-hidden />
        {t("acknowledge")}
      </button>
    </div>
  );
}
