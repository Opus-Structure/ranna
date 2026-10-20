"use client";

import { useEffect, useState } from "react";

/**
 * Keeps the display awake while `active` (re-acquired when the tab comes back, since browsers
 * release the lock on hide). Returns whether the lock is currently held; unsupported browsers
 * and refusals just report false and the screen may dim.
 */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (stopped) return void lock.release().catch(() => undefined);
        sentinel = lock;
        setHeld(true);
        lock.addEventListener("release", () => !stopped && setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
      setHeld(false);
    };
  }, [active]);
  return held;
}
