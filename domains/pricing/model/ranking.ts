// Patient-aware ranking: drop trips that break hard rules, then score the rest in dollars
// so every ranking can be explained as "this costs $X more, but …".
import type { Segment, Slice } from "@/domains/travel/index";
import { addDays } from "@/domains/pricing/model/dateWindow";
import type { Trip } from "@/domains/pricing/model/routeOptions";

export type ProfileId = "standard" | "fragile";

export interface Rules {
  maxStops: number; // per direction
  maxLayoverHours: number;
  minConnectionMinutes: number;
}

/** In US dollars. */
export interface Penalties {
  hourPenalty: number; // per hour door to door
  stopPenalty: number; // per stop
  redEyePenalty: number; // per leg in the air between midnight and 5am (departure local time)
}

export type Profile = Rules & Penalties;

/** Starting values; tune after user interviews. */
export const PROFILES: Record<ProfileId, Profile> = {
  standard: { maxStops: 1, maxLayoverHours: 6, minConnectionMinutes: 60, hourPenalty: 15, stopPenalty: 60, redEyePenalty: 40 },
  fragile: { maxStops: 1, maxLayoverHours: 4, minConnectionMinutes: 90, hourPenalty: 35, stopPenalty: 150, redEyePenalty: 120 },
};

/** Stage 3–4 or needing a wheelchair means fragile. */
export function profileFor({ stage, wheelchair = false }: { stage?: string | null; wheelchair?: boolean }): ProfileId {
  return wheelchair || stage === "3" || stage === "4" ? "fragile" : "standard";
}

export type Violation = "arrives-late" | "too-many-stops" | "long-layover" | "tight-connection";
export type RejectReason = Violation | "other-currency";

const HOUR = 3_600_000;
const stopsIn = (s: Slice) => s.segments.length - 1;
const hoursIn = (s: Slice) => (Date.parse(s.segments[s.segments.length - 1].arriveAt) - Date.parse(s.segments[0].departAt)) / HOUR;
const layoversIn = (s: Slice) =>
  s.segments.slice(1).map((next, i) => (Date.parse(next.departAt) - Date.parse(s.segments[i].arriveAt)) / HOUR);
const localDay = (iso: string) => iso.slice(0, 10);

export function stops(t: Trip): number {
  return t.slices.reduce((n, s) => n + stopsIn(s), 0);
}

/** Flying time including layovers, plus ground transfers. */
export function travelHours(t: Trip): number {
  return t.slices.reduce((h, s) => h + hoursIn(s), 0) + t.groundHours;
}

/** Legs in the air at any point between midnight and 5am, in the departure airport's local time. */
export function overnightLegs(segments: Segment[]): number {
  return segments.filter((g) => {
    const depart = Date.parse(g.departAt);
    const arrive = Date.parse(g.arriveAt);
    const midnight = Date.parse(`${localDay(g.departAt)}T00:00:00${g.departAt.slice(19)}`);
    // Tonight's early hours, or tomorrow's: a leg is never longer than a day.
    return [midnight, midnight + 24 * HOUR].some((start) => depart < start + 5 * HOUR && arrive > start);
  }).length;
}

export function violations(t: Trip, rules: Rules, { appointment, arrivalBufferDays }: { appointment: string; arrivalBufferDays: number }): Violation[] {
  const out: Violation[] = [];
  const arrival = t.slices[0].segments[t.slices[0].segments.length - 1].arriveAt;
  if (localDay(arrival) > addDays(appointment, -arrivalBufferDays)) out.push("arrives-late");
  if (t.slices.some((s) => stopsIn(s) > rules.maxStops)) out.push("too-many-stops");
  const layovers = t.slices.flatMap(layoversIn);
  if (layovers.some((h) => h > rules.maxLayoverHours)) out.push("long-layover");
  if (layovers.some((h) => h * 60 < rules.minConnectionMinutes)) out.push("tight-connection");
  return out;
}

/** In dollars: the trip's fare, fees and ground cost converted with `usdPerUnit`, plus the dollar penalties. */
export function score(t: Trip, p: Penalties, usdPerUnit = 1): number {
  const redEyes = overnightLegs(t.slices.flatMap((s) => s.segments));
  return (t.totalAmount + t.fees + t.groundCost) * usdPerUnit + travelHours(t) * p.hourPenalty + stops(t) * p.stopPenalty + redEyes * p.redEyePenalty;
}

export interface Ranked {
  trip: Trip;
  score: number;
  stops: number;
  hours: number;
}

export interface Pick extends Ranked {
  why: string;
}

export interface Ranking {
  picks: { cheapest: Pick | null; easiest: Pick | null; balanced: Pick | null };
  /** Valid trips, best balance first. */
  valid: Ranked[];
  rejected: { trip: Trip; reasons: RejectReason[] }[];
}

export interface RankOptions {
  profile: ProfileId;
  appointment: string;
  arrivalBufferDays: number;
  /** Only trips priced in this currency are compared; others are rejected as "other-currency". */
  currency: string;
  /** Dollars per unit of `currency`, to weigh fares against the dollar penalties. */
  usdPerUnit?: number;
}

const cost = (r: Ranked) => r.trip.totalAmount + r.trip.fees + r.trip.groundCost;

function money(amount: number, currency: string) {
  const n = Math.round(amount).toLocaleString("en-US");
  return currency === "USD" ? `$${n}` : `${n} ${currency}`;
}

function explain(pick: Ranked, cheapest: Ranked): string {
  if (pick.trip.id === cheapest.trip.id) return "Lowest total price";
  const diff = Math.round(cost(pick) - cost(cheapest));
  const lead = diff <= 0 ? "Same price as the cheapest" : `${money(diff, pick.trip.currency)} more than the cheapest`;
  if (pick.stops === 0 && cheapest.stops > 0) return `${lead}, but non-stop`;
  if (pick.stops < cheapest.stops) return `${lead}, but fewer stops`;
  const saved = Math.round(cheapest.hours - pick.hours);
  if (saved >= 1) return `${lead}, but ${saved} ${saved === 1 ? "hour" : "hours"} less travelling`;
  return `${lead}, but an easier journey overall`;
}

export function rank(trips: Trip[], { profile, appointment, arrivalBufferDays, currency, usdPerUnit = 1 }: RankOptions): Ranking {
  const p = PROFILES[profile];
  const valid: Ranked[] = [];
  const rejected: Ranking["rejected"] = [];
  for (const trip of trips) {
    if (trip.currency !== currency) {
      rejected.push({ trip, reasons: ["other-currency"] });
      continue;
    }
    const reasons = violations(trip, p, { appointment, arrivalBufferDays });
    if (reasons.length) rejected.push({ trip, reasons });
    else valid.push({ trip, score: score(trip, p, usdPerUnit), stops: stops(trip), hours: travelHours(trip) });
  }
  valid.sort((a, b) => a.score - b.score);
  if (!valid.length) return { picks: { cheapest: null, easiest: null, balanced: null }, valid, rejected };

  const minBy = (key: (r: Ranked) => number[]) =>
    valid.reduce((best, r) => {
      const [a, b] = [key(r), key(best)];
      const i = a.findIndex((v, k) => v !== b[k]);
      return i !== -1 && a[i] < b[i] ? r : best;
    });
  const cheapest = minBy((r) => [cost(r), r.score]);
  const easiest = minBy((r) => [r.stops, r.hours, cost(r)]);
  const balanced = valid[0];
  const pick = (r: Ranked): Pick => ({ ...r, why: explain(r, cheapest) });
  return { picks: { cheapest: pick(cheapest), easiest: pick(easiest), balanced: pick(balanced) }, valid, rejected };
}
