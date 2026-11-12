// The only module importing the Duffel SDK. Search reads only; booking writes use duffelTransport.ts.
import { Duffel } from "@duffel/api";
import { z } from "zod/v4";
import type { Fare } from "./fare";
import type { FlightProvider, Passenger } from "./flightProvider";
import { ProviderError, safeProviderError } from "./providerError";

const airport = z.object({ iata_code: z.string().length(3), time_zone: z.string().optional() });
const condition = z.object({ allowed: z.boolean(), penalty_amount: z.string().nullish(), penalty_currency: z.string().nullish() }).nullish();
const schema = z.object({
  id: z.string(), total_amount: z.string(), total_currency: z.string().length(3), expires_at: z.iso.datetime({ offset: true }), live_mode: z.boolean(), partial: z.boolean().optional(),
  payment_requirements: z.object({ requires_instant_payment: z.boolean() }),
  passengers: z.array(z.object({ id: z.string(), type: z.enum(["adult", "child", "infant_without_seat"]).optional() })),
  conditions: z.object({ refund_before_departure: condition, change_before_departure: condition }).nullish(),
  void_window_ends_at: z.string().nullish(),
  slices: z.array(z.object({ origin: airport, destination: airport, segments: z.array(z.object({ origin: airport, destination: airport, departing_at: z.string(), arriving_at: z.string(), operating_carrier: z.object({ iata_code: z.string().nullable(), name: z.string() }), operating_carrier_flight_number: z.string() })).min(1) })).min(1),
});

/** Convert local airport wall time to an explicit offset, rejecting missing/ambiguous DST information. */
export function airportTime(local: string, zone?: string): string {
  if (/(Z|[+-]\d{2}:\d{2})$/.test(local)) return local.replace(/Z$/, "+00:00");
  if (!zone || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local)) throw new ProviderError("provider_unavailable");
  const nominal = Date.parse(local + "Z");
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const wall = (ms: number) => formatter.format(new Date(ms)).replace(" ", "T");
  const offsets = new Set([-86400000, 0, 86400000].map((delta) => (Date.parse(wall(nominal + delta) + "Z") - nominal - delta) / 60000));
  const candidates = [...offsets].filter((offset) => wall(nominal - offset * 60000) === local);
  if (candidates.length !== 1) throw new ProviderError("provider_unavailable");
  const offset = candidates[0]; const abs = Math.abs(offset);
  return `${local}${offset < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
export function mapOffer(value: unknown, live: boolean, now = Date.now()): Fare {
  const raw = schema.parse(value);
  const amount = Number(raw.total_amount);
  if (raw.live_mode !== live || raw.partial || Date.parse(raw.expires_at) <= now || !Number.isFinite(amount) || amount < 0) throw new ProviderError("offer_gone", 410);
  const describe = (c: z.infer<typeof condition>) => !c ? "Terms unavailable; confirm before booking." : !c.allowed ? "Not permitted by this fare." : `Permitted${c.penalty_amount ? `; penalty ${c.penalty_amount} ${c.penalty_currency ?? raw.total_currency}` : "; check airline penalties"}.`;
  return { id: raw.id, provider: "duffel", totalAmount: amount, currency: raw.total_currency, expiresAt: raw.expires_at, holdable: !raw.payment_requirements.requires_instant_payment,
    passengerIds: raw.passengers.map((p) => p.id), ...(raw.passengers.every((p) => p.type) ? { passengerTypes: raw.passengers.map((p) => p.type!) } : {}), voidWindowEndsAt: raw.void_window_ends_at ?? null,
    conditions: { refund: describe(raw.conditions?.refund_before_departure), change: describe(raw.conditions?.change_before_departure) },
    slices: raw.slices.map((s) => ({ from: s.origin.iata_code, to: s.destination.iata_code, segments: s.segments.map((g) => ({ from: g.origin.iata_code, to: g.destination.iata_code, departAt: airportTime(g.departing_at, g.origin.time_zone), arriveAt: airportTime(g.arriving_at, g.destination.time_zone), carrier: g.operating_carrier.iata_code ?? g.operating_carrier.name, carrierName: g.operating_carrier.name, flightNumber: g.operating_carrier_flight_number })) })),
  };
}
export interface DuffelSearchClient {
  create(input: Record<string, unknown>): Promise<{ id: string }>;
  list(requestId: string): Promise<unknown[]>;
  get(id: string): Promise<unknown>;
}
export function createDuffelProvider({ token, client, now = Date.now, limiter }: { token: string; client?: DuffelSearchClient; now?: () => number; limiter?: { consume(): Promise<void>; observe(headers: { get(name: string): string | null }): Promise<void> } }): FlightProvider {
  const live = token.startsWith("duffel_live_");
  if (!token.startsWith("duffel_test_") && !live) throw new ProviderError("provider_not_configured");
  if (!client) {
    const sdk = new Duffel({ token });
    async function guarded<T>(run: () => Promise<{ data: T; headers?: { get(name: string): string | null } }>): Promise<T> {
      await limiter?.consume();
      try { const response = await run(); if (response.headers) await limiter?.observe(response.headers); return response.data; }
      catch (error) { const headers = (error as { headers?: { get(name: string): string | null } }).headers; if (headers) await limiter?.observe(headers); throw error; }
    }
    client = {
      create: (input) => guarded(() => sdk.offerRequests.create(input as unknown as Parameters<typeof sdk.offerRequests.create>[0])),
      list: (id) => guarded(() => sdk.offers.list({ offer_request_id: id, sort: "total_amount", limit: 200 })),
      get: (id) => guarded(() => sdk.offers.get(id)),
    };
  }
  const api = client;
  const passengers = (party: Passenger[]) => party.map((p) => p.type === "child" ? { age: p.age } : p.type === "infant_without_seat" ? { type: "infant_without_seat" } : { type: "adult" });
  async function search(slices: Record<string, string>[], party: Passenger[], max = 1) {
    try {
      const request = await api.create({ slices, passengers: passengers(party), cabin_class: "economy", max_connections: max, supplier_timeout: 10000, return_offers: false });
      const offers = await api.list(request.id);
      return offers.flatMap((raw) => { try { const fare = mapOffer(raw, live, now()); if (fare.slices.length !== slices.length || fare.slices.some((s, i) => s.from !== slices[i].origin || s.to !== slices[i].destination || s.segments[0].departAt.slice(0, 10) !== slices[i].departure_date)) return []; return [fare]; } catch { return []; } }).sort((a, b) => a.totalAmount - b.totalAmount);
    } catch (error) { throw safeProviderError(error); }
  }
  return { name: "duffel", mode: live ? "live" : "test",
    searchReturn: (q) => search([{ origin: q.from, destination: q.to, departure_date: q.out }, { origin: q.to, destination: q.from, departure_date: q.back }], q.passengers, q.maxConnections),
    searchOneWay: (q) => search([{ origin: q.from, destination: q.to, departure_date: q.date }], q.passengers, q.maxConnections),
    async reprice(id) { try { return mapOffer(await api.get(id), live, now()); } catch (error) { const safe = safeProviderError(error); if (safe.code === "offer_gone") return null; throw safe; } },
  };
}
