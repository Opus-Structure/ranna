import type { OpeningHoursDay } from "@/lib/db/schema/types";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Day of week (0 = Sunday) and minute of day at `at`, in the shop's time zone. */
export function localDayMinute(at: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: weekdayIndex[get("weekday")] ?? 0,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * Whether the shop's posted hours cover `at`. A day whose close time is at or before its open
 * time runs past midnight (18:00–02:00). No hours configured means always open.
 */
export function isWithinHours(
  hours: OpeningHoursDay[] | undefined,
  timeZone: string,
  at: Date,
): boolean {
  if (!hours?.length) return true;
  const { day, minute } = localDayMinute(at, timeZone);
  const today = hours.find((h) => h.day === day);
  if (today && !today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (close > open ? minute >= open && minute < close : minute >= open) return true;
  }
  const yesterday = hours.find((h) => h.day === (day + 6) % 7);
  if (yesterday && !yesterday.closed) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);
    if (close <= open && minute < close) return true;
  }
  return false;
}

/** The next opening within a week, as day + "HH:MM", or null when every day is closed. */
export function nextOpening(
  hours: OpeningHoursDay[] | undefined,
  timeZone: string,
  at: Date,
): { day: number; time: string; today: boolean } | null {
  if (!hours?.length) return null;
  const { day, minute } = localDayMinute(at, timeZone);
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    const slot = hours.find((h) => h.day === d);
    if (!slot || slot.closed) continue;
    if (offset === 0 && toMinutes(slot.open) <= minute) continue;
    return { day: d, time: slot.open, today: offset === 0 };
  }
  return null;
}
