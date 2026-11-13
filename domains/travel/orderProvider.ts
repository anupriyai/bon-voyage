import { getRateLimiter } from "@/domains/pricing/server";
import type { Fare } from "./fare";
import type { BookFlightInput } from "./bookingSchema";
import type { Booking } from "./db";
import { createDuffelTransport, OrderReceiptSchema, type OrderReceipt, type WriteResult } from "./duffelTransport";
export interface OrderProvider {
  create(fare: Fare, input: BookFlightInput): Promise<WriteResult>;
  get(booking: Booking): Promise<OrderReceipt>;
  reconcile(booking: Booking): Promise<OrderReceipt | null>;
  pay(booking: Booking, order: OrderReceipt, attemptId: string): Promise<WriteResult>;
}
export function createOrderProvider(token?: string): OrderProvider {
  if (!token) {
    const receipt = (b: Pick<Booking, "attemptId" | "orderId" | "total" | "currency" | "status" | "bookingReference" | "payBy" | "paidAt">): OrderReceipt => ({ id: b.orderId ?? `mock_order_${b.attemptId}`, total_amount: b.total, total_currency: b.currency, live_mode: false, booking_reference: b.bookingReference ?? "MOCK-" + b.attemptId.slice(0, 6), metadata: { attempt_id: b.attemptId }, payment_status: { awaiting_payment: b.status === "held", paid_at: b.paidAt?.toISOString() ?? (b.status === "confirmed" ? new Date().toISOString() : null), payment_required_by: b.payBy?.toISOString() ?? null } });
    return {
      async create(fare, input) { return { outcome: "created", data: { id: `mock_order_${input.attemptId}`, total_amount: fare.totalAmount.toFixed(2), total_currency: fare.currency, live_mode: false, booking_reference: "MOCK-" + input.attemptId.slice(0, 6), metadata: { attempt_id: input.attemptId }, payment_status: { awaiting_payment: input.type === "hold", paid_at: input.type === "instant" ? new Date().toISOString() : null, payment_required_by: input.type === "hold" ? new Date(Date.now() + 3600000).toISOString() : null } } }; },
      async get(b) { return receipt(b); }, async reconcile(b) { return b.orderId ? receipt(b) : null; },
      async pay(b, order) { return { outcome: "created", data: { ...order, payment_status: { awaiting_payment: false, paid_at: new Date().toISOString(), payment_required_by: null } } }; },
    };
  }
  const http = createDuffelTransport(token, fetch, getRateLimiter(token, "interactive"));
  const unwrap = (v: unknown) => OrderReceiptSchema.parse((v as { data: unknown }).data);
  return {
    async create(fare, input) {
      const passengerIds = fare.passengerIds ?? [];
      const passengers = input.travelers.map((p, i) => ({ id: passengerIds[i], given_name: p.givenName, family_name: p.familyName, born_on: p.bornOn, title: p.title, gender: p.gender, email: p.email, phone_number: p.phone,
        ...(p.document ? { identity_documents: [{ type: "passport", unique_identifier: p.document.number, issuing_country_code: p.document.issuingCountry, expires_on: p.document.expiresOn }] } : {}) }));
      input.travelers.forEach((p, i) => { if (p.infantFor !== undefined) Object.assign(passengers[p.infantFor], { infant_passenger_id: passengerIds[i] }); });
      return http.write("/air/orders", { type: input.type, selected_offers: [fare.id], passengers, metadata: { attempt_id: input.attemptId }, ...(input.type === "instant" ? { payments: [{ type: "balance", amount: fare.totalAmount.toFixed(2), currency: fare.currency }] } : {}) }, input.attemptId);
    },
    async get(b) { return unwrap(await http.read(`/air/orders/${encodeURIComponent(b.orderId!)}`)); },
    async reconcile(b) {
      const response = await http.read(`/air/orders?offer_id=${encodeURIComponent(b.offerId)}&limit=200`) as { data: unknown[] };
      const matches = response.data.flatMap((v) => { const parsed = OrderReceiptSchema.safeParse(v); return parsed.success && parsed.data.metadata.attempt_id === b.attemptId ? [parsed.data] : []; });
      return matches.length === 1 ? matches[0] : null;
    },
    async pay(b, order, attemptId) { return http.write("/air/payments", { order_id: b.orderId, payment: { type: "balance", amount: order.total_amount, currency: order.total_currency } }, attemptId); },
  };
}
