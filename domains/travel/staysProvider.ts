import { addDays } from "@/domains/pricing";
export interface StayQuery { checkIn: string; checkOut: string; rooms: number; guests: number; latitude: number; longitude: number; radiusKm: number; wheelchair: boolean }
export interface StayResult { resultId: string; accommodationId: string; name: string; distanceKm: number; mobility: boolean | null; amount: number; currency: string }
export interface StayRate { rateId: string; amount: number; currency: string; dueAtAccommodation: number | null; dueCurrency: string; conditions: string[] }
export interface StayQuote extends StayRate { accommodationId: string; mobility: boolean | null; quoteId: string; expiresAt: string; checkIn: string; checkOut: string }
export interface StayReceipt { id: string; status: "confirmed" | "cancelled"; reference: string | null; attemptId: string }
export interface StayGuest { givenName: string; familyName: string }
export interface StayProvider {
  name: "mock" | "duffel"; mode: "sample" | "test";
  search(query: StayQuery): Promise<StayResult[]>;
  rates(resultId: string): Promise<StayRate[]>;
  quote(rateId: string): Promise<StayQuote>;
  getQuote(quoteId: string): Promise<StayQuote>;
  book(quote: StayQuote, input: { attemptId: string; email: string; phone: string; guests: StayGuest[]; wheelchair: boolean }): Promise<{ outcome: "created" | "checking" | "failed"; receipt?: StayReceipt }>;
  reconcile(orderId: string | null, attemptId: string): Promise<StayReceipt | null>;
}
export function stayNights(query: Pick<StayQuery, "checkIn" | "checkOut">, today = new Date().toISOString().slice(0, 10)) {
  addDays(query.checkIn, 0); addDays(query.checkOut, 0);
  const nights = (Date.parse(query.checkOut + "T00:00:00Z") - Date.parse(query.checkIn + "T00:00:00Z")) / 86400000;
  if (query.checkIn < today || query.checkIn > addDays(today, 330) || nights < 1 || nights > 99) throw new Error("Stay must be 1–99 nights; longer stays need a coordinator.");
  return nights;
}
export function rankStays(results: StayResult[], query: StayQuery) {
  const valid = results.filter((r) => r.distanceKm <= query.radiusKm && (!query.wheelchair || r.mobility === true));
  return valid.filter((r) => r.currency === valid[0]?.currency).sort((a, b) => (a.amount + a.distanceKm * 5) - (b.amount + b.distanceKm * 5));
}
