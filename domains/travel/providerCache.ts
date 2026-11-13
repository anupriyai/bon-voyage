import type { Fare } from "./fare";
import type { FlightProvider } from "./flightProvider";
export function cacheProvider(source: FlightProvider, now = Date.now): FlightProvider {
  const entries = new Map<string, { expires: number; fares: Fare[] }>();
  async function cached(key: string, run: () => Promise<Fare[]>) {
    const entry = entries.get(key);
    if (entry && entry.expires > now()) return structuredClone(entry.fares);
    const fares = await run();
    const expires = Math.min(now() + 15 * 60000, ...fares.filter((f) => f.expiresAt).map((f) => Date.parse(f.expiresAt!)));
    if (entries.size >= 128) entries.delete(entries.keys().next().value!);
    if (fares.length && expires > now()) entries.set(key, { fares: structuredClone(fares), expires });
    return fares;
  }
  return { name: source.name, mode: source.mode,
    searchReturn: (q) => cached(JSON.stringify(["return", q.from, q.to, q.out, q.back, q.passengers, "economy", q.maxConnections ?? 1]), () => source.searchReturn(q)),
    searchOneWay: (q) => cached(JSON.stringify(["oneway", q.from, q.to, q.date, q.passengers, "economy", q.maxConnections ?? 1]), () => source.searchOneWay(q)),
    reprice: (id) => source.reprice(id),
  };
}
