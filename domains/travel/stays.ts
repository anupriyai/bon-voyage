import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { getDb, withActor, type Actor, type Db } from "@/shared/lib/db";
import { HttpError } from "@/shared/lib/http";
import { getCaseStore } from "@/domains/case/server";
import { HOSPITAL_BY_ID, flightContext } from "@/domains/case";
import { createBookingStore } from "./bookingStore";
import { bookings, stayQuotes, staySearches } from "./db";
import { createMockStaysProvider } from "./mockStaysProvider";
import { createDuffelStaysProvider } from "./duffelStaysProvider";
import { rankStays, stayNights, type StayProvider, type StayQuery, type StayQuote, type StayRate, type StayResult } from "./staysProvider";
const contextHash = (text: string) => createHmac("sha256", process.env.DATA_KEY ?? "unconfigured").update(text).digest("hex");
export const StaySearchSchema = z.object({ caseId: z.uuid(), checkIn: z.string(), checkOut: z.string(), rooms: z.number().int().min(1).max(5), guests: z.number().int().min(1).max(9), radiusKm: z.number().min(1).max(100) }).strict();
export const StayBookSchema = z.object({ caseId: z.uuid(), localQuoteId: z.uuid(), attemptId: z.uuid(), expectedAmount: z.number().finite().min(0), currency: z.string().regex(/^[A-Z]{3}$/), expectedDue: z.number().finite().min(0).nullable(), dueCurrency: z.string().regex(/^[A-Z]{3}$/), acceptedConditions: z.literal(true), email: z.email(), phone: z.string().regex(/^\+[1-9]\d{6,14}$/), guests: z.array(z.object({ givenName: z.string().min(1).max(50), familyName: z.string().min(1).max(50) }).strict()).min(1).max(9) }).strict();
export function getStayProvider(): StayProvider {
  if (process.env.DUFFEL_STAYS_ENABLED !== "true") return createMockStaysProvider();
  const token = process.env.DUFFEL_ACCESS_TOKEN; if (!token?.startsWith("duffel_test_")) throw new HttpError(503, "stays_test_access_required");
  return createDuffelStaysProvider(token);
}
export function createStaysService(db: Db, provider: StayProvider) {
  const bookingStore = createBookingStore(db);
  async function ownState(actor: Actor, caseId: string) { return (await getCaseStore().loadCase(actor, caseId)).state; }
  async function loadSearch(actor: Actor, id: string, caseId: string) {
    await ownState(actor, caseId);
    const [row] = await db.select().from(staySearches).where(and(eq(staySearches.id, id), eq(staySearches.caseId, caseId), eq(staySearches.ownerId, actor.id)));
    if (!row) throw new HttpError(404, "not_found");
    const state = await ownState(actor, caseId);
    if (row.parameters.context !== contextHash(flightContext(state))) throw new HttpError(409, "travel_details_changed");
    if (row.provider !== provider.name || Date.now() - row.createdAt.getTime() > 15 * 60000) throw new HttpError(410, "stay_search_expired");
    return { row, state };
  }
  return {
    async search(actor: Actor, value: unknown) {
      const input = StaySearchSchema.parse(value); const state = await ownState(actor, input.caseId);
      if (!state.chosenId) throw new HttpError(400, "choose_hospital_first");
      try { stayNights(input); } catch { throw new HttpError(400, "stay_needs_coordinator"); }
      const hospital = HOSPITAL_BY_ID[state.chosenId];
      const query: StayQuery = { ...input, latitude: hospital.lat, longitude: hospital.lon, wheelchair: state.travelSchedule?.wheelchair ?? false };
      const results = rankStays(await provider.search(query), query).slice(0, 100);
      const [search] = await withActor(db, actor, (tx) => tx.insert(staySearches).values({ caseId: input.caseId, ownerId: actor.id, provider: provider.name, parameters: { ...input, context: contextHash(flightContext(state)) }, results }).returning());
      return { searchId: search.id, results, mode: provider.mode, currency: results[0]?.currency ?? "USD" };
    },
    async quote(actor: Actor, caseId: string, searchId: string, resultId: string) {
      const { row, state } = await loadSearch(actor, searchId, caseId);
      const result = (row.results as StayResult[]).find((r) => r.resultId === resultId); if (!result) throw new HttpError(404, "not_found");
      const rates = await provider.rates(resultId);
      const rate = rates.filter((r) => r.currency === result.currency).sort((a, b) => Number(a.dueAtAccommodation === null) - Number(b.dueAtAccommodation === null) || a.amount - b.amount)[0];
      if (!rate) throw new HttpError(410, "stay_rate_gone");
      const quote = await provider.quote(rate.rateId);
      if (quote.accommodationId !== result.accommodationId || (state.travelSchedule?.wheelchair && quote.mobility !== true)) throw new HttpError(409, "stay_suitability_changed");
      if (quote.checkIn !== row.parameters.checkIn || quote.checkOut !== row.parameters.checkOut) throw new HttpError(409, "stay_dates_changed");
      const [saved] = await withActor(db, actor, (tx) => tx.insert(stayQuotes).values({ searchId, caseId, quoteId: quote.quoteId, data: { ...quote, conditions: quote.conditions.length ? quote.conditions : rate.conditions, name: result.name, rateId: rate.rateId }, expiresAt: new Date(Math.min(Date.parse(quote.expiresAt), Date.now() + 10 * 60000)) }).returning());
      return { ...quote, conditions: quote.conditions.length ? quote.conditions : rate.conditions, rateId: rate.rateId, localQuoteId: saved.id, name: result.name, mode: provider.mode };
    },
    async book(actor: Actor, value: unknown) {
      const input = StayBookSchema.parse(value);
      const hash = contextHash(JSON.stringify(input));
      const previous = await bookingStore.attempt(actor, input.attemptId);
      if (previous) { if (previous.requestHash !== hash || previous.resource !== "stay") throw new HttpError(409, "attempt_conflict"); return previous; }
      const state = await ownState(actor, input.caseId);
      const [saved] = await db.select().from(stayQuotes).where(and(eq(stayQuotes.id, input.localQuoteId), eq(stayQuotes.caseId, input.caseId)));
      if (!saved || saved.expiresAt.getTime() <= Date.now()) throw new HttpError(410, "stay_quote_expired");
      const { row } = await loadSearch(actor, saved.searchId, input.caseId);
      if (input.guests.length !== row.parameters.guests) throw new HttpError(400, "invalid_guests");
      const fresh = await provider.getQuote(saved.quoteId);
      if (fresh.accommodationId !== saved.data.accommodationId || (state.travelSchedule?.wheelchair && fresh.mobility !== true)) throw new HttpError(409, "stay_suitability_changed");
      if (fresh.quoteId !== saved.quoteId || fresh.checkIn !== saved.data.checkIn || fresh.checkOut !== saved.data.checkOut) throw new HttpError(409, "stay_dates_changed");
      if (!fresh.conditions.length) fresh.conditions = saved.data.conditions as string[];
      if (fresh.currency !== input.currency || Math.round(fresh.amount * 100) !== Math.round(input.expectedAmount * 100) || fresh.dueAtAccommodation !== input.expectedDue || fresh.dueCurrency !== input.dueCurrency) throw new HttpError(409, "price_changed");
      const claim = await bookingStore.claim(actor, { caseId: input.caseId, attemptId: input.attemptId, resource: "stay", provider: provider.name, offerId: fresh.quoteId, bookingType: "instant", status: "creating", total: fresh.amount.toFixed(2), currency: fresh.currency, bookedBy: actor.id, requestHash: hash, details: { assistance: state.travelSchedule?.wheelchair ?? false, sample: provider.name === "mock", mode: provider.mode, name: saved.data.name, dueAtAccommodation: fresh.dueAtAccommodation, dueCurrency: fresh.dueCurrency, checkIn: fresh.checkIn, checkOut: fresh.checkOut, conditions: fresh.conditions } });
      if (!claim.claimed) return claim.booking;
      let result; try { result = await provider.book(fresh, { ...input, wheelchair: state.travelSchedule?.wheelchair ?? false }); } catch { result = { outcome: "checking" as const }; }
      if (result.outcome !== "created" || result.receipt?.attemptId !== input.attemptId) return bookingStore.update(actor, claim.booking.id, { status: result.outcome === "failed" ? "failed" : "checking" });
      return bookingStore.update(actor, claim.booking.id, { orderId: result.receipt.id, bookingReference: result.receipt.reference, status: result.receipt.status }, state.travelSchedule?.wheelchair ? "accommodation_accessibility" : undefined);
    },
    async reconcile(actor: Actor, id: string) {
      const booking = await bookingStore.owned(actor, id); if (booking.resource !== "stay" || booking.provider !== provider.name) throw new HttpError(409, "provider_changed");
      const receipt = await provider.reconcile(booking.orderId, booking.attemptId);
      if (!receipt || receipt.attemptId !== booking.attemptId) return booking;
      return bookingStore.update(actor, id, { orderId: receipt.id, bookingReference: receipt.reference, status: receipt.status }, booking.details.assistance ? "accommodation_accessibility" : undefined);
    },
    async list(actor: Actor, caseId: string) { return (await bookingStore.list(actor, caseId)).filter((b) => b.resource === "stay"); },
  };
}
export const getStaysService = () => createStaysService(getDb(), getStayProvider());
