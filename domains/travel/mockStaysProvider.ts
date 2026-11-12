import { z } from "zod/v4";
import { stayNights, type StayProvider } from "./staysProvider";
const payloadSchema = z.object({ checkIn: z.string(), checkOut: z.string(), rooms: z.number().int().min(1).max(5), guests: z.number().int().min(1).max(9), index: z.number().int().min(0).max(2), issued: z.number().optional() });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function decode(id: string, prefix: string) { if (!id.startsWith(prefix)) throw new Error("invalid_stay_id"); return payloadSchema.parse(JSON.parse(Buffer.from(id.slice(prefix.length), "base64url").toString())); }
export function createMockStaysProvider(now = Date.now): StayProvider {
  const rate = (p: z.infer<typeof payloadSchema>) => ({ rateId: "mock_rate_" + encode({ ...p, issued: undefined }), amount: stayNights(p, new Date(now()).toISOString().slice(0, 10)) * [95, 70, 110][p.index] * p.rooms, currency: "USD", dueAtAccommodation: p.index === 2 ? null : stayNights(p, new Date(now()).toISOString().slice(0, 10)) * 3, dueCurrency: "USD", conditions: ["Sample: free cancellation until 48 hours before check-in; confirm conditions in a fresh quote."] });
  const quote = (p: z.infer<typeof payloadSchema>) => ({ ...rate(p), accommodationId: `mock_hotel_${p.index}`, mobility: [true, false, null][p.index], quoteId: "mock_quote_" + encode(p), expiresAt: new Date((p.issued ?? now()) + 10 * 60000).toISOString(), checkIn: p.checkIn, checkOut: p.checkOut });
  return { name: "mock", mode: "sample",
    async search(q) { stayNights(q, new Date(now()).toISOString().slice(0, 10)); return [0, 1, 2].map((index) => { const p = { checkIn: q.checkIn, checkOut: q.checkOut, rooms: q.rooms, guests: q.guests, index }; return { resultId: "mock_result_" + encode(p), accommodationId: `mock_hotel_${index}`, name: ["Sample Care Residence", "Sample City Hotel", "Sample Garden Suites"][index], distanceKm: [0.8, 2.5, 0.4][index], mobility: [true, false, null][index], amount: rate(p).amount, currency: "USD" }; }); },
    async rates(id) { return [rate(decode(id, "mock_result_"))]; },
    async quote(id) { return quote({ ...decode(id, "mock_rate_"), issued: now() }); },
    async getQuote(id) { const p = decode(id, "mock_quote_"); if (now() >= (p.issued ?? 0) + 600000) throw new Error("quote_expired"); return quote(p); },
    async book(q, input) { await this.getQuote(q.quoteId); return { outcome: "created", receipt: { id: "mock_stay_booking_" + input.attemptId, status: "confirmed", reference: "STAY-" + input.attemptId.slice(0, 6), attemptId: input.attemptId } }; },
    async reconcile(orderId, attemptId) { return orderId ? { id: orderId, status: "confirmed", reference: "STAY-" + attemptId.slice(0, 6), attemptId } : null; },
  };
}
