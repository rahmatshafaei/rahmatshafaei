/** Date helpers. Calendar dates are ISO strings (YYYY-MM-DD) in the Europe/Stockholm zone. */

export const APP_TIME_ZONE = "Europe/Stockholm";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIso(now = new Date(), timeZone = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return addDays(iso, -(wd - 1));
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("sv-SE", { ...options, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

export function formatLongDate(iso: string): string {
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long" });
}

export function relativeDayLabel(iso: string, today = todayIso()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Idag";
  if (diff === -1) return "Igår";
  if (diff === 1) return "Imorgon";
  return formatLongDate(iso);
}

export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

/** Calendar date of a timestamp in the app time zone. */
export function isoDateOf(timestamp: string): string {
  return todayIso(new Date(timestamp));
}
