// Realistic, deterministic sample fares for when no Duffel token is set. Same search → same fares,
// so the demo and the tests never need the network. Offsets are fixed (no daylight saving): sample data only.
import type { Fare, Segment, Slice } from "@/domains/travel/fare";
import type { FlightProvider, Passenger } from "@/domains/travel/flightProvider";

interface MockAirport {
  lat: number;
  lon: number;
  /** UTC offset in minutes. */
  utc: number;
}

const AIRPORTS: Record<string, MockAirport> = {
  AMM: { lat: 31.72, lon: 35.99, utc: 180 },
  AQJ: { lat: 29.61, lon: 35.02, utc: 180 },
  RUH: { lat: 24.96, lon: 46.7, utc: 180 },
  JED: { lat: 21.68, lon: 39.16, utc: 180 },
  DXB: { lat: 25.25, lon: 55.36, utc: 240 },
  AUH: { lat: 24.43, lon: 54.65, utc: 240 },
  BEY: { lat: 33.82, lon: 35.49, utc: 120 },
  CAI: { lat: 30.12, lon: 31.41, utc: 120 },
  IST: { lat: 41.26, lon: 28.74, utc: 180 },
  SAW: { lat: 40.9, lon: 29.31, utc: 180 },
  BER: { lat: 52.37, lon: 13.5, utc: 60 },
  FRA: { lat: 50.03, lon: 8.56, utc: 60 },
  LHR: { lat: 51.47, lon: -0.45, utc: 0 },
  DOH: { lat: 25.27, lon: 51.61, utc: 180 },
};
const HUBS = ["IST", "DXB", "DOH", "CAI", "FRA", "AMM"];
const CARRIERS = ["RJ", "TK", "MS", "EK", "LH", "SV", "ME", "QR"];

/** Small seeded PRNG (mulberry32) over a string hash. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function km(a: MockAirport, b: MockAirport) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function localIso(ms: number, utc: number) {
  const sign = utc < 0 ? "-" : "+";
  const abs = Math.abs(utc);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return new Date(ms + utc * 60_000).toISOString().slice(0, 19) + off;
}

function leg(from: string, to: string, departMs: number, carrier: string, n: number): Segment {
  const [a, b] = [AIRPORTS[from], AIRPORTS[to]];
  const hours = km(a, b) / 750 + 0.5;
  const arriveMs = departMs + Math.round(hours * 12) * 300_000; // 5-minute steps
  return { from, to, departAt: localIso(departMs, a.utc), arriveAt: localIso(arriveMs, b.utc), carrier, flightNumber: `${carrier}${100 + n}` };
}

const lastArrive = (segs: Segment[]) => Date.parse(segs[segs.length - 1].arriveAt);

/** Itineraries for one direction on one day, with a per-adult price. */
function itineraries(from: string, to: string, date: string, maxConnections: number): { slice: Slice; perAdult: number }[] {
  const [a, b] = [AIRPORTS[from], AIRPORTS[to]];
  if (!a || !b || from === to) return [];
  const rand = rng(`${from}-${to}-${date}`);
  const dayFactor = 0.85 + rand() * 0.35;
  const base = 60 + km(a, b) * 0.11;
  const departAt = (hour: number) => Date.parse(`${date}T${String(hour).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}:00Z`) - a.utc * 60_000;
  const carrier = () => CARRIERS[Math.floor(rand() * CARRIERS.length)];

  const out: { slice: Slice; perAdult: number }[] = [];
  const nonstops = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < nonstops; i++) {
    const segs = [leg(from, to, departAt(Math.floor(rand() * 23)), carrier(), out.length)];
    out.push({ slice: { from, to, segments: segs }, perAdult: Math.round(base * dayFactor * (1 + rand() * 0.35)) });
  }
  if (maxConnections >= 1) {
    const hubs = HUBS.filter((h) => h !== from && h !== to);
    const count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      const hub = hubs[Math.floor(rand() * hubs.length)];
      const first = leg(from, hub, departAt(Math.floor(rand() * 20)), carrier(), out.length);
      const layover = (rand() < 0.15 ? 7 : 1.5 + rand() * 3.5) * 3_600_000;
      const second = leg(hub, to, Math.round((lastArrive([first]) + layover) / 300_000) * 300_000, carrier(), out.length + 50);
      out.push({ slice: { from, to, segments: [first, second] }, perAdult: Math.round(base * dayFactor * (0.7 + rand() * 0.25)) });
    }
  }
  return out;
}

function total(perAdult: number, passengers: Passenger[]) {
  return passengers.reduce((sum, p) => sum + (p.type === "child" ? Math.round(perAdult * 0.75) : perAdult), 0);
}

export function createMockProvider(): FlightProvider {
  const issued = new Map<string, Fare>();
  const issue = (fares: Fare[]) => {
    fares.sort((x, y) => x.totalAmount - y.totalAmount).forEach((f) => issued.set(f.id, f));
    return fares;
  };
  const paxKey = (passengers: Passenger[]) => passengers.map((p) => (p.type === "child" ? `c${p.age ?? ""}` : "a")).join("");
  const fare = (id: string, slices: Slice[], totalAmount: number): Fare => ({
    id,
    provider: "mock",
    slices,
    totalAmount,
    currency: "USD",
    expiresAt: null,
    holdable: rng(id)() < 0.5, // about half of airlines allow a hold
  });

  return {
    name: "mock",
    async searchOneWay({ from, to, date, passengers, maxConnections = 1 }) {
      const key = paxKey(passengers);
      return issue(itineraries(from, to, date, maxConnections).map((it, i) => fare(`mock_${from}_${to}_${date}_${key}_${i}`, [it.slice], total(it.perAdult, passengers))));
    },
    async searchReturn({ from, to, out, back, passengers, maxConnections = 1 }) {
      const key = paxKey(passengers);
      const outs = itineraries(from, to, out, maxConnections).slice(0, 2);
      const backs = itineraries(to, from, back, maxConnections).slice(0, 2);
      const fares = outs.flatMap((o, i) =>
        backs
          .filter((b) => Date.parse(b.slice.segments[0].departAt) > lastArrive(o.slice.segments))
          .map((b, j) => fare(`mock_rt_${from}_${to}_${out}_${back}_${key}_${i}${j}`, [o.slice, b.slice], total(Math.round((o.perAdult + b.perAdult) * 0.92), passengers))),
      );
      return issue(fares);
    },
    async reprice(fareId) {
      return issued.get(fareId) ?? null;
    },
  };
}
