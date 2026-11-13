// Which extra searches are worth spending the provider's small rate limit on, and how fares become comparable trips.
import type { Fare, Slice } from "@/domains/travel/index";
import type { DateWindow } from "@/domains/pricing/model/dateWindow";

export interface Ground {
  cost: number;
  hours: number;
}

/**
 * Rough door-to-airport transfer estimate: a private car at `perKm`, 60 km/h, plus a fixed pickup cost.
 * Labelled as an estimate in the UI; it only exists so a cheaper far airport doesn't look better than it is.
 */
export function groundTransfer(distanceKm: number, { perKm = 0.5, base = 15 }: { perKm?: number; base?: number } = {}): Ground {
  if (distanceKm <= 0) return { cost: 0, hours: 0 };
  return { cost: Math.round(base + distanceKm * perKm), hours: Math.round((distanceKm / 60 + 0.5) * 10) / 10 };
}

/** One round-trip search. */
export interface TripQuery {
  from: string;
  to: string;
  out: string;
  back: string;
}

/** An alternate airport counts like this many days away from the target dates. */
const ALTERNATE_WEIGHT = 1.5;

/**
 * Extra round-trip searches for "widen search", most promising first, at most `budget` of them.
 * `origins[0]` and `destinations[0]` are the main airports; the rest are alternates. The target query itself
 * (already searched) is left out. Closer dates and main airports come first.
 */
export function planWiden({ origins, destinations, window, target, budget }: {
  origins: string[];
  destinations: string[];
  window: DateWindow;
  target: { out: string; back: string };
  budget: number;
}): TripQuery[] {
  const outAt = window.outbound.indexOf(target.out);
  const backAt = window.return.indexOf(target.back);
  const ranked: { q: TripQuery; priority: number; dates: number }[] = [];
  origins.forEach((from, oi) =>
    destinations.forEach((to, di) =>
      window.outbound.forEach((out, i) =>
        window.return.forEach((back, j) => {
          const dates = Math.abs(i - outAt) + Math.abs(j - backAt);
          const alternates = (oi > 0 ? 1 : 0) + (di > 0 ? 1 : 0);
          if (dates === 0 && alternates === 0) return;
          ranked.push({ q: { from, to, out, back }, priority: dates + alternates * ALTERNATE_WEIGHT, dates });
        }),
      ),
    ),
  );
  return ranked
    .sort((a, b) => a.priority - b.priority || a.dates - b.dates)
    .slice(0, budget)
    .map((r) => r.q);
}

export interface Fees {
  /** Charged once per ticket (order). */
  perOrder: number;
  /** Percent of the fare. */
  pct: number;
}

export interface Trip {
  /** Fare id for a round-trip ticket; "outId+backId" for two separate one-way tickets. */
  id: string;
  /** "split" = two separate tickets: two sets of fees, and no protection if one flight is cancelled. */
  kind: "return" | "split";
  fares: Fare[];
  slices: [Slice, Slice];
  totalAmount: number;
  currency: string;
  /** Booking fees we pay per ticket, in the trip's currency. */
  fees: number;
  /** Estimated transfers at every airport used: home side and hospital side, both directions. */
  groundCost: number;
  groundHours: number;
}

const firstDepart = (s: Slice) => s.segments[0].departAt;
const lastArrive = (s: Slice) => s.segments[s.segments.length - 1].arriveAt;

/**
 * Round-trip fares, plus any valid pairing of outbound and return one-ways (same currency, return departs
 * after the outbound lands) as separate tickets, cheapest comparable total first.
 * `groundByAirport` holds each airport's transfer from its own anchor: home for origin airports, the hospital for
 * destination airports (0 or absent for the main airports).
 */
export function combine(
  outbound: Fare[],
  back: Fare[],
  returns: Fare[] = [],
  { groundByAirport = {}, fees = { perOrder: 0, pct: 0 } }: { groundByAirport?: Record<string, Ground>; fees?: Fees } = {},
): Trip[] {
  const ground = (slices: [Slice, Slice]) => {
    const ends = [slices[0].from, slices[0].to, slices[1].from, slices[1].to];
    return {
      groundCost: ends.reduce((sum, a) => sum + (groundByAirport[a]?.cost ?? 0), 0),
      groundHours: ends.reduce((sum, a) => sum + (groundByAirport[a]?.hours ?? 0), 0),
    };
  };
  const feesFor = (fares: Fare[]) => fares.reduce((sum, f) => sum + fees.perOrder + (f.totalAmount * fees.pct) / 100, 0);
  const valid = (s: [Slice, Slice]) => Date.parse(firstDepart(s[1])) > Date.parse(lastArrive(s[0]));

  const trips: Trip[] = [];
  for (const r of returns) {
    if (r.slices.length !== 2) continue;
    const slices: [Slice, Slice] = [r.slices[0], r.slices[1]];
    if (!valid(slices)) continue;
    trips.push({ id: r.id, kind: "return", fares: [r], slices, totalAmount: r.totalAmount, currency: r.currency, fees: feesFor([r]), ...ground(slices) });
  }
  for (const o of outbound) {
    for (const b of back) {
      const slices: [Slice, Slice] = [o.slices[0], b.slices[0]];
      if (o.currency !== b.currency || !valid(slices)) continue;
      trips.push({ id: `${o.id}+${b.id}`, kind: "split", fares: [o, b], slices, totalAmount: o.totalAmount + b.totalAmount, currency: o.currency, fees: feesFor([o, b]), ...ground(slices) });
    }
  }
  const comparable = (t: Trip) => t.totalAmount + t.fees + t.groundCost;
  return trips.sort((a, b) => comparable(a) - comparable(b));
}
