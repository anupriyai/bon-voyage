// Searching within the flight provider's small rate limit (Duffel: about 10 searches a minute, shared by
// everyone). A patient's search is one round-trip request at the best dates. "Widen search" spends a capped
// number of extra round-trip requests (planWiden), and two separate one-way tickets are only a fallback.
import type { FlightProvider, Passenger } from "@/domains/travel/index";
import type { DateWindow } from "@/domains/pricing/model/dateWindow";
import { combine, type Fees, type Ground, type Trip, type TripQuery } from "@/domains/pricing/model/routeOptions";

interface Common {
  passengers: Passenger[];
  maxConnections?: 0 | 1 | 2;
  groundByAirport?: Record<string, Ground>;
  fees?: Fees;
}

/** The latest departure in the window and the first day after recovery. */
export function targetDates(window: DateWindow): { out: string; back: string } {
  return { out: window.outbound[window.outbound.length - 1], back: window.return[0] };
}

/** Runs `tasks` with at most `limit` in flight. A failed task yields null instead of failing the rest. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch {
        results[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** The default search: one round-trip request. */
export async function searchTrips(provider: FlightProvider, { query, passengers, maxConnections = 1, groundByAirport, fees }: Common & { query: TripQuery }): Promise<Trip[]> {
  const returns = await provider.searchReturn({ ...query, passengers, maxConnections });
  return combine([], [], returns, { groundByAirport, fees });
}

/** "Widen search": the planned extra round trips, a few at a time. */
export async function widenTrips(
  provider: FlightProvider,
  { queries, passengers, maxConnections = 1, groundByAirport, fees, concurrency = 2 }: Common & { queries: TripQuery[]; concurrency?: number },
): Promise<{ trips: Trip[]; requests: number; failures: number }> {
  const results = await pool(
    queries.map((q) => () => provider.searchReturn({ ...q, passengers, maxConnections })),
    concurrency,
  );
  const trips = combine([], [], results.flatMap((r) => r ?? []), { groundByAirport, fees });
  return { trips, requests: queries.length, failures: results.filter((r) => r === null).length };
}

/** Last resort when no round trip works: two separate one-way tickets (two requests). */
export async function splitFallback(provider: FlightProvider, { query, passengers, maxConnections = 1, groundByAirport, fees }: Common & { query: TripQuery }): Promise<Trip[]> {
  const [out, back] = await Promise.all([
    provider.searchOneWay({ from: query.from, to: query.to, date: query.out, passengers, maxConnections }),
    provider.searchOneWay({ from: query.to, to: query.from, date: query.back, passengers, maxConnections }),
  ]);
  return combine(out, back, [], { groundByAirport, fees });
}
