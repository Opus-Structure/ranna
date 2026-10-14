"use client";

import { unlockSound } from "./chime";

/** What this browser can do for "ring me when it's ready". Computed on the client only. */
export type AlertSupport = {
  /** Web push available here (service workers + Push API + notifications). */
  push: boolean;
  ios: boolean;
  /** Running as an installed Home Screen app. */
  standalone: boolean;
  /** iPhone/iPad in Safari: push only after "Add to Home Screen" (iOS 16.4+). */
  needsHomeScreen: boolean;
  permission: NotificationPermission | "unsupported";
};

export function alertSupport(): AlertSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  const push = "serviceWorker" in nav && "PushManager" in window && "Notification" in window;
  return {
    push,
    ios,
    standalone,
    needsHomeScreen: ios && !standalone,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  };
}

function vapidKey(): Uint8Array | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushOutcome = "on" | "denied" | "unsupported" | "error";

/**
 * Asks for notification permission and registers this browser for the order's "ready" push.
 * Must run from a tap (browsers refuse permission prompts otherwise).
 */
export async function enablePush(token: string): Promise<PushOutcome> {
  const support = alertSupport();
  const key = vapidKey();
  if (!support.push || !key) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      }));
    const res = await fetch(`/api/orders/${token}/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    return res.ok ? "on" : "error";
  } catch {
    return "error";
  }
}

/* ------------------------------------------------------------------ alarm */

let alarmCtx: AudioContext | null = null;

/** One burst of the alarm: three urgent beeps. Needs audio unlocked by an earlier tap. */
function burst(ctx: AudioContext) {
  const start = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const t = start + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = i === 2 ? 1568 : 1175;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.01);
    gain.gain.setValueAtTime(0.28, t + 0.15);
    gain.gain.linearRampToValueAtTime(0, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

/**
 * Loops the alarm (sound + vibration) until stopped or `maxMs` passes. Returns a stop function.
 * Sound plays only if audio was unlocked by a tap earlier; vibration where supported.
 */
export function startAlarm(maxMs = 3 * 60_000): () => void {
  let stopped = false;
  const startedAt = Date.now();
  const tick = () => {
    if (stopped || Date.now() - startedAt > maxMs) return stop();
    if (!alarmCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      alarmCtx = Ctor ? new Ctor() : null;
    }
    if (alarmCtx?.state === "running") burst(alarmCtx);
    navigator.vibrate?.([400, 150, 400]);
  };
  const id = window.setInterval(tick, 1600);
  tick();
  function stop() {
    stopped = true;
    window.clearInterval(id);
    navigator.vibrate?.(0);
  }
  return stop;
}

/** Unlocks both the chime and the alarm audio on a tap. */
export async function unlockAlarm(): Promise<boolean> {
  if (!alarmCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    alarmCtx = Ctor ? new Ctor() : null;
  }
  if (alarmCtx && alarmCtx.state !== "running") {
    await Promise.race([
      alarmCtx.resume().catch(() => undefined),
      new Promise((r) => setTimeout(r, 1000)),
    ]);
  }
  await unlockSound();
  return alarmCtx?.state === "running";
}

/** Keeps the screen on while waiting (a sleeping phone can't ring from an open page). */
export async function keepAwake(): Promise<(() => void) | null> {
  try {
    const lock = await navigator.wakeLock?.request("screen");
    return lock ? () => void lock.release().catch(() => undefined) : null;
  } catch {
    return null;
  }
}
