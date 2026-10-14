"use client";

import { BellRing, Check, Loader2, Share, SquarePlus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  alertSupport,
  enablePush,
  keepAwake,
  unlockAlarm,
  type AlertSupport,
  type PushOutcome,
} from "@/lib/orders/alerts";
import { playChime } from "@/lib/orders/chime";
import { cn } from "@/lib/utils";

const storageKey = (token: string) => `ranna:alerts:${token}`;

type Armed = { push: PushOutcome | "skipped"; sound: boolean };

/**
 * "Ring my phone when it's ready": one tap unlocks sound, keeps the screen on and, where the
 * browser allows it, registers a push notification. It says plainly what will and won't work
 * on this phone (iPhone needs the Home Screen app for notifications).
 */
export function AlertsPanel({ token, open }: { token: string; open: boolean }) {
  const t = useTranslations("order.alerts");
  const [support, setSupport] = useState<AlertSupport | null>(null);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [busy, setBusy] = useState(false);
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    setSupport(alertSupport());
    try {
      const saved = localStorage.getItem(storageKey(token));
      if (saved) setArmed(JSON.parse(saved) as Armed);
    } catch {
      // Not essential.
    }
  }, [token]);

  // While armed and waiting, keep the screen on (re-taken when the page comes back).
  useEffect(() => {
    if (!armed || !open) return;
    let release: (() => void) | null = null;
    const take = async () => {
      release?.();
      release = await keepAwake();
      setAwake(Boolean(release));
    };
    void take();
    const onVisible = () => document.visibilityState === "visible" && void take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      release?.();
    };
  }, [armed, open]);

  if (!open || !support) return null;

  async function arm() {
    if (!support) return;
    setBusy(true);
    const sound = await unlockAlarm();
    if (sound) playChime();
    const push: Armed["push"] = support.needsHomeScreen ? "skipped" : await enablePush(token);
    const next = { push, sound };
    setArmed(next);
    try {
      localStorage.setItem(storageKey(token), JSON.stringify(next));
    } catch {
      // Not essential.
    }
    setBusy(false);
  }

  if (armed) {
    const lines = [
      {
        ok: armed.push === "on",
        text: armed.push === "on" ? t("status.push") : t(`status.noPush.${armed.push}`),
      },
      { ok: true, text: t("status.page") },
      ...(awake ? [{ ok: true, text: t("status.awake") }] : []),
    ];
    return (
      <section
        aria-labelledby="alerts-title"
        className="rounded-3xl bg-[var(--shop-card)] p-5 shadow-[0_10px_30px_-22px_rgb(31_26_23/0.35)]"
      >
        <h2 id="alerts-title" className="flex items-center gap-2 font-bold">
          <BellRing className="size-5 text-[var(--brand-ink)]" aria-hidden />
          {t("on")}
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {lines.map((l) => (
            <li key={l.text} className="flex items-start gap-2">
              {l.ok ? (
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--brand-ink)]" aria-hidden />
              ) : (
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-[var(--shop-muted)]"
                  aria-hidden
                />
              )}
              <span className={cn(!l.ok && "text-[var(--shop-muted)]")}>{l.text}</span>
            </li>
          ))}
        </ul>
        {support.needsHomeScreen ? <HomeScreenGuide /> : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="alerts-title"
      className="rounded-3xl border-2 border-[var(--brand-ink)] bg-[var(--shop-card)] p-5"
    >
      <h2 id="alerts-title" className="flex items-center gap-2 text-lg font-bold">
        <BellRing className="size-5 text-[var(--brand-ink)]" aria-hidden />
        {t("title")}
      </h2>
      <p className="mt-2 text-pretty text-[var(--shop-muted)]">
        {support.needsHomeScreen ? t("bodyIos") : support.push ? t("body") : t("bodyNoPush")}
      </p>
      <button
        type="button"
        onClick={() => void arm()}
        disabled={busy}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-base font-bold text-[var(--brand-contrast)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)] active:scale-[0.99] disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <BellRing className="size-5" aria-hidden />
        )}
        {support.needsHomeScreen ? t("enableHere") : t("enable")}
      </button>
      {support.needsHomeScreen ? <HomeScreenGuide /> : null}
    </section>
  );
}

/** iPhone: notifications only reach Home Screen apps (iOS 16.4+). */
function HomeScreenGuide() {
  const t = useTranslations("order.alerts.ios");
  return (
    <details className="mt-4 rounded-2xl bg-[var(--shop-ground)] px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">{t("title")}</summary>
      <ol className="mt-3 flex list-decimal flex-col gap-2 ps-5 text-[var(--shop-muted)]">
        <li>
          {t("step1")}{" "}
          <Share className="inline size-4 align-text-bottom" aria-label={t("shareIcon")} />
        </li>
        <li>
          {t("step2")} <SquarePlus className="inline size-4 align-text-bottom" aria-hidden />
        </li>
        <li>{t("step3")}</li>
      </ol>
    </details>
  );
}
