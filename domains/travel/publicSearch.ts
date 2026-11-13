// Public exploration is always sample-only. Never select a provider from environment credentials here.
import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { findPublicOffer } from "@/domains/providers";
import { findOffer } from "@/domains/providers/archivedSampleOffers";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { createMockProvider, SAMPLE_AIRPORTS } from "./mockProvider";
import { createMockStaysProvider } from "./mockStaysProvider";
import type { Fare } from "./fare";
import { rankStays, type StayQuote, type StayResult } from "./staysProvider";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const base = { offerId: z.string().min(1).max(120), out: day, back: day, travellers: z.number().int().min(1).max(9) };
export const PublicFlightSearchSchema = z.object({ ...base, from: z.string().regex(/^[A-Z]{3}$/) }).strict();
export const PublicStaySearchSchema = z.object({ ...base, wheelchair: z.boolean().default(false) }).strict();
export interface PublicStayOption extends StayResult { quote: StayQuote }
export interface CareTravelDraft { offerId: string; from: string; out: string; back: string; travellers: number; flightId: string | null; stayQuoteId: string | null }

function validDates(out: string, back: string, now: number) {
  const dates = [out, back].map((d) => Date.parse(`${d}T00:00:00Z`));
  if (dates.some((d, i) => !Number.isFinite(d) || new Date(d).toISOString().slice(0, 10) !== [out, back][i])) throw new HttpError(400, "invalid_dates");
  const today = new Date(now).toISOString().slice(0, 10);
  const max = new Date(now + 330 * 86400000).toISOString().slice(0, 10);
  const nights = (dates[1] - dates[0]) / 86400000;
  if (out < today || out > max || back > max || nights < 1 || nights > 99) throw new HttpError(400, "invalid_dates");
}
function offerFor(id: string) {
  const offer = findOffer(id);
  if (!offer) throw new HttpError(404, "offer_not_found");
  return offer;
}
export async function publicSampleFlights(value: unknown, now = Date.now()): Promise<Fare[]> {
  const input = PublicFlightSearchSchema.parse(value); const offer = offerFor(input.offerId);
  validDates(input.out, input.back, now);
  if (!SAMPLE_AIRPORTS.includes(input.from) || !SAMPLE_AIRPORTS.includes(offer.airport) || input.from === offer.airport) throw new HttpError(400, "invalid_airports");
  const fares = await createMockProvider().searchReturn({ from: input.from, to: offer.airport, out: input.out, back: input.back, passengers: Array.from({ length: input.travellers }, () => ({ type: "adult" as const })), maxConnections: 1 });
  return fares.filter((fare) => fare.slices.every((slice) => slice.segments.length <= 2)).sort((a, b) => a.totalAmount - b.totalAmount).slice(0, 8);
}
const publicQuoteId = (offerId: string, quoteId: string) => `sample_care_stay_${Buffer.from(JSON.stringify({ offerId, quoteId })).toString("base64url")}`;
function unpackQuote(id: string) {
  if (!id.startsWith("sample_care_stay_") || id.length > 2000) throw new HttpError(400, "invalid_stay_selection");
  try { return z.object({ offerId: z.string(), quoteId: z.string() }).strict().parse(JSON.parse(Buffer.from(id.slice(17), "base64url").toString())); }
  catch { throw new HttpError(400, "invalid_stay_selection"); }
}
export async function publicSampleStays(value: unknown, now = Date.now()): Promise<PublicStayOption[]> {
  const input = PublicStaySearchSchema.parse(value); const offer = offerFor(input.offerId);
  validDates(input.out, input.back, now);
  const provider = createMockStaysProvider(() => now);
  const query = { checkIn: input.out, checkOut: input.back, rooms: Math.ceil(input.travellers / 2), guests: input.travellers, latitude: offer.latitude, longitude: offer.longitude, radiusKm: 10, wheelchair: input.wheelchair };
  return Promise.all(rankStays(await provider.search(query), query).map(async (result) => {
    const [rate] = await provider.rates(result.resultId); const quote = await provider.quote(rate.rateId);
    return { ...result, name: `${result.name} · ${offer.city}`, quote: { ...quote, quoteId: publicQuoteId(offer.id, quote.quoteId) } };
  }));
}
/** Validate untrusted browser selections against regenerated sample offers. No client amount is accepted. */
export async function verifyCareTravelSelection(draft: CareTravelDraft, now = Date.now()): Promise<{ fare: Fare | null; stay: PublicStayOption | null }> {
  const offer = offerFor(draft.offerId);
  if (draft.out || draft.back) validDates(draft.out, draft.back, now);
  if (draft.from && !SAMPLE_AIRPORTS.includes(draft.from)) throw new HttpError(400, "invalid_airports");
  let fare: Fare | null = null; let stay: PublicStayOption | null = null;
  if (draft.flightId) {
    fare = (await publicSampleFlights({ offerId: draft.offerId, from: draft.from, out: draft.out, back: draft.back, travellers: draft.travellers }, now)).find((item) => item.id === draft.flightId) ?? null;
    if (!fare) throw new HttpError(409, "flight_selection_changed");
  }
  if (draft.stayQuoteId) {
    const payload = unpackQuote(draft.stayQuoteId);
    if (payload.offerId !== draft.offerId) throw new HttpError(409, "stay_selection_changed");
    try {
      validDates(draft.out, draft.back, now);
      const provider = createMockStaysProvider(() => now); const quote = await provider.getQuote(payload.quoteId);
      if (!Number.isFinite(Date.parse(quote.expiresAt)) || Date.parse(quote.expiresAt) > now + 600000) throw new Error("future_quote");
      const results = await publicSampleStays({ offerId: draft.offerId, out: draft.out, back: draft.back, travellers: draft.travellers }, now);
      const match = results.find((item) => item.accommodationId === quote.accommodationId && item.quote.rateId === quote.rateId);
      if (!match || quote.checkIn !== draft.out || quote.checkOut !== draft.back) throw new Error("mismatch");
      stay = { ...match, name: `${match.name.split(" · ")[0]} · ${offer.city}`, quote: { ...quote, quoteId: draft.stayQuoteId } };
    } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(409, "stay_selection_expired"); }
  }
  return { fare, stay };
}

// A bounded, process-local sample-search budget. No keys, paid searches or patient information are used.
const buckets = new Map<string, { count: number; reset: number }>();
let globalBudget = { count: 0, reset: 0 };
function reserve(request: Request, now: number) {
  if (now >= globalBudget.reset) globalBudget = { count: 0, reset: now + 60000 };
  const key = createHash("sha256").update(`${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}:${request.headers.get("user-agent") ?? ""}`).digest("hex");
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) bucket = { count: 0, reset: now + 60000 };
  if (bucket.count >= 20 || globalBudget.count >= 300) throw new HttpError(429, "rate_limited");
  bucket.count++; globalBudget.count++;
  if (buckets.size >= 512 && !buckets.has(key)) buckets.delete(buckets.keys().next().value!);
  buckets.set(key, bucket);
}
export function createPublicTravelHandler(kind: "flights" | "stays") {
  return async function POST(request: Request) {
    try {
      requireSameOrigin(request); reserve(request, Date.now()); const input = await readJson(request, 4000);
      if (!input || typeof input !== "object" || !findPublicOffer((input as { offerId?: string }).offerId ?? "")) throw new HttpError(404, "offer_not_found");
      return privateJson(kind === "flights" ? { sample: true, fares: await publicSampleFlights(input) } : { sample: true, stays: await publicSampleStays(input) });
    } catch (error) {
      if (error instanceof HttpError) return privateJson({ error: error.code }, error.status);
      if (error instanceof z.ZodError) return privateJson({ error: "invalid_request" }, 400);
      return privateJson({ error: "sample_search_unavailable" }, 503);
    }
  };
}
