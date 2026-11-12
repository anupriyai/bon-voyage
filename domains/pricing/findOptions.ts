// Search orchestration accepts a provider; it is safe for the local sample preview and server tests.
import type { CaseState } from "@/domains/case";
import { airportsFor, alternatesFor, type FlightProvider, type Passenger } from "@/domains/travel";
import { addDays, dateWindow } from "./model/dateWindow";
import { groundTransfer, planWiden, type Ground } from "./model/routeOptions";
import { profileFor, rank } from "./model/ranking";
import { priceCalendar } from "./model/priceWatch";
import { planningUsdRate } from "./model/exchange";
import { searchTrips, targetDates, widenTrips } from "./search";

export interface FlightSchedule {
  appointment: string;
  treatmentDays: number;
  recoveryDays: number;
  passengers: number;
  companionAges?: number[];
  wheelchair: boolean;
  flexDays?: 0 | 1;
  widen?: boolean;
}
export function flightQuery(state: CaseState, schedule: FlightSchedule, today = new Date().toISOString().slice(0, 10)) {
  const { appointment, treatmentDays, recoveryDays, passengers, wheelchair, flexDays = 1 } = schedule;
  addDays(appointment, 0);
  if (![treatmentDays, recoveryDays, passengers].every(Number.isInteger) || treatmentDays < 1 || treatmentDays > 730 || recoveryDays < 0 || recoveryDays > 730 || passengers < 1 || passengers > 9 || ![0, 1].includes(flexDays)) throw new Error("Check the treatment days, recovery days and travellers.");
  const airports = airportsFor(state);
  const window = dateWindow({ appointment, treatmentDays, recoveryDays, flexDays, arrivalBufferDays: 2 });
  window.outbound = window.outbound.filter((d) => d >= today);
  if (!window.outbound.length) throw new Error("Choose an appointment at least two days ahead to allow arrival before treatment.");
  const target = targetDates(window);
  const alternates = [airports.from, airports.to].flatMap((a) => alternatesFor(a));
  const groundByAirport: Record<string, Ground> = Object.fromEntries(alternates.map((a) => [a.iata, groundTransfer(a.extraKm)]));
  const age = state.intake.age ? Number(state.intake.age) : 30;
  const companions = schedule.companionAges ?? Array.from({ length: passengers - 1 }, () => 30);
  const ages = [age, ...companions];
  if (ages.length !== passengers || ages.some((a) => !Number.isInteger(a) || a < 0 || a > 120)) throw new Error("Check every traveller’s age before searching.");
  if (ages.filter((a) => a < 2).length > ages.filter((a) => a >= 18).length) throw new Error("Each infant needs a separate carrying adult.");
  const party: Passenger[] = ages.map((age) => age < 2 ? { type: "infant_without_seat", age } : age < 12 ? { type: "child", age } : { type: "adult" });
  return { ...airports, window, target, groundByAirport, passengers: party, profile: profileFor({ stage: state.intake.stage, wheelchair }) };
}

export async function findOptions(state: CaseState, schedule: FlightSchedule, provider: FlightProvider, today?: string) {
  const query = flightQuery(state, schedule, today);
  const common = { passengers: query.passengers, groundByAirport: query.groundByAirport, maxConnections: 1 as const };
  const trips = await searchTrips(provider, { ...common, query: { from: query.from, to: query.to, ...query.target } });
  let extraRequests = 0;
  let failures = 0;
  if (schedule.widen) {
    const queries = planWiden({
      origins: [query.from, ...alternatesFor(query.from).map((a) => a.iata)],
      destinations: [query.to, ...alternatesFor(query.to).map((a) => a.iata)],
      window: query.window, target: query.target, budget: 2,
    });
    const extra = await widenTrips(provider, { ...common, queries });
    trips.push(...extra.trips);
    extraRequests = extra.requests;
    failures = extra.failures;
  }
  const unique = [...new Map(trips.map((t) => [t.id, t])).values()];
  const currency = unique[0]?.currency ?? "USD";
  const usdPerUnit = planningUsdRate(currency);
  for (const trip of unique) trip.groundCost /= planningUsdRate(trip.currency);
  const ranking = rank(unique, { profile: query.profile, appointment: schedule.appointment, arrivalBufferDays: 2, currency, usdPerUnit });
  return { currency, usdPerUnit, mode: provider.mode ?? (provider.name === "mock" ? "sample" : "test"), sample: provider.name === "mock", provider: provider.name, ranking, calendar: priceCalendar(ranking.valid.map((r) => r.trip), currency), window: query.window, from: query.from, to: query.to, extraRequests, requests: 1 + extraRequests, failures };
}
export type FlightOptions = Awaited<ReturnType<typeof findOptions>> & { searchId?: string };
