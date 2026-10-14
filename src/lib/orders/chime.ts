"use client";

/**
 * The new-order chime: two short rising tones made with WebAudio (no audio file to load or
 * cache). Browsers only allow sound after a tap on the page, so `unlock()` runs on the first
 * gesture and the board shows a button until it has.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function soundUnlocked(): boolean {
  return ctx?.state === "running";
}

export async function unlockSound(): Promise<boolean> {
  const c = context();
  if (!c) return false;
  // resume() can stay pending for ever without an audio device: give it a second at most.
  if (c.state !== "running") {
    await Promise.race([
      c.resume().catch(() => undefined),
      new Promise((r) => setTimeout(r, 1000)),
    ]);
  }
  return c.state === "running";
}

export function playChime(): void {
  const c = context();
  if (!c || c.state !== "running") return;
  const start = c.currentTime + 0.02;
  [880, 1318.5].forEach((freq, i) => {
    const t = start + i * 0.18;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

const PREF_KEY = "ranna:board-sound";

export function soundPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundPreference(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Not essential.
  }
}
