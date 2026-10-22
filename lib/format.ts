const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function usd(n: number): string {
  return usdFmt.format(Math.round(n));
}

/** "+$340" / "−$340" / "$0". Uses a true minus sign. */
export function signedUsd(n: number): string {
  const r = Math.round(n);
  if (r === 0) return usd(0);
  return `${r > 0 ? "+" : "−"}${usdFmt.format(Math.abs(r))}`;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const longFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

/** "Mon 2 Nov" */
export function fmtDay(d: Date): string {
  return dayFmt.format(d);
}

/** "28 Sep 2026" */
export function fmtLong(d: Date): string {
  return longFmt.format(d);
}

export function fmtTime(d: Date): string {
  return timeFmt.format(d).replace(" ", "").toLowerCase();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtHours(h: number): string {
  const mins = Math.round((h * 60) / 5) * 5;
  const hr = Math.floor(mins / 60);
  const m = mins % 60;
  if (hr === 0) return `${m} min`;
  if (m === 0) return `${hr} hr`;
  return `${hr} hr ${m} min`;
}

export function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

export function round100(n: number): number {
  return Math.round(n / 100) * 100;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
