import { TZDate } from "@date-fns/tz";

export const SALON_TZ = "Europe/Madrid";

/** Devuelve el instante UTC correspondiente a `minutes` desde la medianoche local del día `day` (YYYY-MM-DD). */
export function atLocalMinutes(day: string, minutes: number, tz = SALON_TZ): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, tz).getTime());
}

/** Minutos desde medianoche local para un instante. */
export function localMinutes(date: Date, tz = SALON_TZ): number {
  const z = new TZDate(date.getTime(), tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** YYYY-MM-DD en hora local del salón. */
export function localDay(date: Date, tz = SALON_TZ): string {
  const z = new TZDate(date.getTime(), tz);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

export function localWeekday(day: string, tz = SALON_TZ): number {
  return new TZDate(atLocalMinutes(day, 12 * 60, tz).getTime(), tz).getDay();
}

export function addMinutes(date: Date, min: number): Date {
  return new Date(date.getTime() + min * 60_000);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function formatHM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
