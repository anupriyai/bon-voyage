// Fare drops for saved searches, and the cheapest fare per day for the price calendar.
// No forecasting: we only report prices we have actually seen.
import type { Trip } from "@/domains/pricing/model/routeOptions";

export interface DropThreshold {
  pct: number;
  /** In the watch's currency. */
  amount: number;
}

export const DEFAULT_DROP: DropThreshold = { pct: 5, amount: 30 };

const cents = (n: number) => Math.round(n * 100);

/** True when `current` is at least `pct`% or `amount` below `baseline`. Compared in whole cents. */
export function isDrop(baseline: number | null, current: number, { pct, amount }: DropThreshold = DEFAULT_DROP): boolean {
  if (baseline === null) return false;
  const saved = cents(baseline) - cents(current);
  if (saved <= 0) return false;
  return saved >= cents(amount) || saved * 100 >= pct * cents(baseline);
}

export interface WatchState {
  /** The price the family was last told about (first seen, then each alert). Drops are measured from here. */
  baseline: number | null;
  /** Lowest price seen, for display. */
  lowest: number | null;
}

/** One scheduled re-check: the new state, and an alert when the price fell enough to tell the family. */
export function checkWatch(
  { baseline, lowest }: WatchState,
  current: number | null,
  threshold: DropThreshold = DEFAULT_DROP,
): WatchState & { alert: { from: number; to: number } | null } {
  if (current === null) return { baseline, lowest, alert: null };
  const alert = baseline !== null && isDrop(baseline, current, threshold) ? { from: baseline, to: current } : null;
  return {
    baseline: baseline === null || alert ? current : baseline,
    lowest: lowest === null ? current : Math.min(lowest, current),
    alert,
  };
}

/**
 * Cheapest comparable total (fare + fees + ground) for each outbound day, in one currency.
 * Pass valid trips only (`rank(...).valid`), so the calendar never shows a fare the patient can't take.
 */
export function priceCalendar(trips: Trip[], currency: string): { day: string; amount: number; currency: string }[] {
  const byDay = new Map<string, number>();
  for (const t of trips) {
    if (t.currency !== currency) continue;
    const day = t.slices[0].segments[0].departAt.slice(0, 10);
    const amount = t.totalAmount + t.fees + t.groundCost;
    const seen = byDay.get(day);
    if (seen === undefined || amount < seen) byDay.set(day, amount);
  }
  return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => ({ day, amount, currency }));
}
