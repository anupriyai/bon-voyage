import { z } from "zod/v4";
import { getRateLimiter } from "@/domains/pricing/server";
import { createDuffelTransport } from "./duffelTransport";
import { ProviderError, safeProviderError } from "./providerError";
import { stayNights, type StayProvider, type StayQuote, type StayReceipt } from "./staysProvider";
const money = z.string().regex(/^\d+(\.\d+)?$/);
const coordinates = z.object({ latitude: z.number(), longitude: z.number() });
const accommodation = z.object({ id: z.string(), name: z.string(), amenities: z.array(z.object({ type: z.string() })).nullable(), location: z.object({ geographic_coordinates: coordinates.nullable() }) });
const rateSchema = z.object({ id: z.string(), total_amount: money, total_currency: z.string().length(3), due_at_accommodation_amount: money.nullable(), due_at_accommodation_currency: z.string().length(3), conditions: z.array(z.object({ title: z.string(), description: z.string() })).default([]) });
const receipt = z.object({ id: z.string(), status: z.enum(["confirmed", "cancelled"]), reference: z.string().nullable(), live_mode: z.literal(false).optional(), metadata: z.record(z.string(), z.string()).nullable() });
const distance = (a: number, b: number, c: number, d: number) => { const r = Math.PI / 180; const h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
export function createDuffelStaysProvider(token: string, fetcher: typeof fetch = fetch, limiterOverride?: { consume(): Promise<void>; observe(headers: Headers): Promise<void> }): StayProvider {
  if (!token.startsWith("duffel_test_")) throw new ProviderError("live_mode_disabled", 403);
  const limiter = limiterOverride ?? getRateLimiter(token, "interactive"); const transport = createDuffelTransport(token, fetcher, limiter);
  async function inventory(path: string, body?: unknown): Promise<unknown> {
    await limiter.consume();
    const response = await fetcher(`https://api.duffel.com${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Duffel-Version": "v2", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify({ data: body }) } : {}), signal: AbortSignal.timeout(20000) });
    await limiter.observe(response.headers);
    if (!response.ok) throw safeProviderError({ status: response.status });
    return (await response.json() as { data: unknown }).data;
  }
  const mapRate = (value: unknown) => { const r = rateSchema.parse(value); return { rateId: r.id, amount: Number(r.total_amount), currency: r.total_currency, dueAtAccommodation: r.due_at_accommodation_amount === null ? null : Number(r.due_at_accommodation_amount), dueCurrency: r.due_at_accommodation_currency, conditions: r.conditions.map((c) => `${c.title}: ${c.description}`) }; };
  const mapQuote = (value: unknown): StayQuote => {
    const q = rateSchema.extend({ accommodation, check_in_date: z.string(), check_out_date: z.string() }).parse(value);
    return { ...mapRate(q), accommodationId: q.accommodation.id, mobility: q.accommodation.amenities === null ? null : q.accommodation.amenities.some((a) => a.type === "accessibility_mobility"), quoteId: q.id, rateId: "", checkIn: q.check_in_date, checkOut: q.check_out_date, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() };
  };
  const mapReceipt = (value: unknown): StayReceipt => { const r = receipt.parse(value); return { id: r.id, status: r.status, reference: r.reference, attemptId: r.metadata?.attempt_id ?? "" }; };
  return { name: "duffel", mode: "test",
    async search(q) {
      stayNights(q);
      const raw = z.object({ results: z.array(z.object({ id: z.string(), accommodation, cheapest_rate_total_amount: money, cheapest_rate_currency: z.string().length(3) })).max(500) }).parse(await inventory("/stays/search", { check_in_date: q.checkIn, check_out_date: q.checkOut, rooms: q.rooms, guests: Array.from({ length: q.guests }, () => ({ type: "adult" })), location: { radius: q.radiusKm, geographic_coordinates: { latitude: q.latitude, longitude: q.longitude } } }));
      return raw.results.flatMap((r) => { const loc = r.accommodation.location.geographic_coordinates; if (!loc) return []; return [{ resultId: r.id, accommodationId: r.accommodation.id, name: r.accommodation.name, distanceKm: distance(q.latitude, q.longitude, loc.latitude, loc.longitude), mobility: r.accommodation.amenities === null ? null : r.accommodation.amenities.some((a) => a.type === "accessibility_mobility"), amount: Number(r.cheapest_rate_total_amount), currency: r.cheapest_rate_currency }]; });
    },
    async rates(id) { const raw = z.object({ accommodation: z.object({ rooms: z.array(z.object({ rates: z.array(z.unknown()) })) }) }).parse(await inventory(`/stays/search_results/${encodeURIComponent(id)}/actions/fetch_all_rates`, {})); return raw.accommodation.rooms.flatMap((r) => r.rates.map(mapRate)); },
    async quote(id) { return { ...mapQuote(await inventory("/stays/quotes", { rate_id: id })), rateId: id }; },
    async getQuote(id) { return mapQuote(await inventory(`/stays/quotes/${encodeURIComponent(id)}`)); },
    async book(q, input) {
      const result = await transport.write("/stays/bookings", { quote_id: q.quoteId, email: input.email, phone_number: input.phone, guests: input.guests.map((g) => ({ given_name: g.givenName, family_name: g.familyName })), metadata: { attempt_id: input.attemptId }, ...(input.wheelchair ? { accommodation_special_requests: "Step-free access and mobility-accessible room requested. Please confirm suitability before arrival." } : {}) }, input.attemptId);
      if (result.outcome !== "created") return { outcome: result.outcome };
      const parsed = receipt.safeParse(result.data); if (!parsed.success) return { outcome: "checking" };
      return { outcome: "created", receipt: mapReceipt(parsed.data) };
    },
    async reconcile(orderId, attemptId) {
      if (orderId) { const result = mapReceipt((await transport.read(`/stays/bookings/${encodeURIComponent(orderId)}`) as { data: unknown }).data); return result.attemptId === attemptId ? result : null; }
      let after: string | null = null;
      for (let page = 0; page < 3; page++) {
        const raw = await transport.read(`/stays/bookings?limit=200${after ? `&after=${encodeURIComponent(after)}` : ""}`) as { data: unknown[]; meta?: { after?: string } };
        const matched = raw.data.map(mapReceipt).filter((r) => r.attemptId === attemptId); if (matched.length === 1) return matched[0]; if (matched.length > 1) return null;
        after = raw.meta?.after ?? null; if (!after) break;
      }
      return null;
    },
  };
}
