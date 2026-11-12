import { createHmac } from "node:crypto";
import type { Actor } from "@/shared/lib/db";
import { HttpError } from "@/shared/lib/http";
import type { FlightProvider } from "./flightProvider";
import type { BookingStore } from "./bookingStore";
import type { OrderProvider } from "./orderProvider";
import { BookFlightSchema, ageOn, validateParty, type BookFlightInput } from "./bookingSchema";
import { OrderReceiptSchema, receiptStatus, type OrderReceipt } from "./duffelTransport";
import type { Booking } from "./db";
export interface BookingDependencies { provider: FlightProvider; orders: OrderProvider; store: BookingStore; hashSecret: string }
const cents = (n: number) => Math.round(n * 100);
export function orderValues(order: OrderReceipt) {
  const date = (value?: string | null) => value ? new Date(value) : null;
  return { orderId: order.id, status: receiptStatus(order), total: order.total_amount, currency: order.total_currency, bookingReference: order.booking_reference ?? null, payBy: date(order.payment_status.payment_required_by), paidAt: date(order.payment_status.paid_at), priceGuaranteeExpiresAt: date(order.price_guarantee_expires_at), voidWindowEndsAt: date(order.void_window_ends_at) };
}
export async function quoteFlight(actor: Actor, input: Pick<BookFlightInput, "caseId" | "searchId" | "offerId">, deps: BookingDependencies) {
  const snapshot = await deps.store.snapshot(actor, input.caseId, input.searchId, input.offerId);
  if (snapshot.provider !== deps.provider.name) throw new HttpError(409, "provider_changed");
  const fare = await deps.provider.reprice(input.offerId);
  if (!fare) throw new HttpError(410, "offer_gone");
  const itinerary = (slices: unknown) => JSON.stringify((slices as { from: string; to: string; segments: { from: string; to: string; departAt: string; arriveAt: string; carrier: string; flightNumber: string }[] }[]).map((slice) => [slice.from, slice.to, slice.segments.map((g) => [g.from, g.to, g.departAt, g.arriveAt, g.carrier, g.flightNumber])]));
  if (fare.id !== input.offerId || itinerary(snapshot.slices) !== itinerary(fare.slices)) throw new HttpError(409, "schedule_changed");
  return fare;
}
export async function bookFlight(actor: Actor, value: unknown, deps: BookingDependencies) {
  const input = BookFlightSchema.parse(value);
  const hash = createHmac("sha256", deps.hashSecret).update(JSON.stringify(input)).digest("hex");
  const previous = await deps.store.attempt(actor, input.attemptId);
  if (previous) {
    if (previous.requestHash !== hash) throw new HttpError(409, "attempt_conflict");
    return previous; // Repeated clicks and interrupted responses never issue a second write.
  }
  const fare = await quoteFlight(actor, input, deps);
  if (fare.currency !== input.currency || cents(fare.totalAmount) !== cents(input.expectedAmount)) throw new HttpError(409, "price_changed");
  if (input.type === "hold" && !fare.holdable) throw new HttpError(409, "hold_unavailable");
  const departure = fare.slices[0].segments[0].departAt.slice(0, 10);
  try { validateParty(input, departure); } catch { throw new HttpError(400, "invalid_travelers"); }
  if (fare.passengerTypes && fare.passengerTypes.some((type, i) => { const age = input.travelers[i] ? ageOn(input.travelers[i].bornOn, departure) : -1; return type !== (age < 2 ? "infant_without_seat" : age < 12 ? "child" : "adult"); })) throw new HttpError(400, "traveler_search_mismatch");
  if (fare.passengerIds && fare.passengerIds.length !== input.travelers.length) throw new HttpError(400, "invalid_travelers");
  const claim = await deps.store.claim(actor, { caseId: input.caseId, attemptId: input.attemptId, offerId: fare.id, provider: fare.provider, resource: "flight", bookingType: input.type, status: "creating", total: fare.totalAmount.toFixed(2), currency: fare.currency, bookedBy: actor.id, requestHash: hash, details: { assistance: input.assistance, sample: fare.provider === "mock", mode: deps.provider.mode ?? "sample", conditions: fare.conditions ?? {}, itinerary: fare.slices } });
  if (!claim.claimed) return claim.booking;
  let result;
  try { result = await deps.orders.create(fare, input); } catch { result = { outcome: "checking" as const }; }
  if (result.outcome !== "created") return deps.store.update(actor, claim.booking.id, { status: result.outcome === "failed" ? "failed" : "checking" });
  const parsed = OrderReceiptSchema.safeParse(result.data);
  if (!parsed.success || parsed.data.live_mode !== (deps.provider.mode === "live") || parsed.data.metadata.attempt_id !== input.attemptId) return deps.store.update(actor, claim.booking.id, { status: "checking" });
  return deps.store.update(actor, claim.booking.id, orderValues(parsed.data), input.assistance ? "airline_assistance" : undefined);
}
export async function reconcileBooking(actor: Actor, booking: Booking, deps: BookingDependencies) {
  const order = booking.orderId ? await deps.orders.get(booking) : await deps.orders.reconcile(booking);
  if (!order || order.metadata.attempt_id !== booking.attemptId || order.live_mode !== (deps.provider.mode === "live")) return booking;
  return deps.store.update(actor, booking.id, orderValues(order), booking.details.assistance ? "airline_assistance" : undefined);
}
export async function payHold(actor: Actor, booking: Booking, expectedAmount: number, currency: string, paymentAttemptId: string, deps: BookingDependencies) {
  if (booking.status !== "held") return reconcileBooking(actor, booking, deps);
  const order = await deps.orders.get(booking);
  if (order.metadata.attempt_id !== booking.attemptId || order.live_mode !== (deps.provider.mode === "live")) throw new HttpError(409, "order_mismatch");
  if (receiptStatus(order) !== "held") return deps.store.update(actor, booking.id, orderValues(order));
  if (booking.scheduleChanged || order.total_currency !== currency || cents(Number(order.total_amount)) !== cents(expectedAmount)) throw new HttpError(409, "price_changed");
  const claimed = await deps.store.claimPayment(actor, booking.id, paymentAttemptId);
  if (!claimed.claimed) return claimed.booking;
  const result = await deps.orders.pay(claimed.booking, order, paymentAttemptId);
  if (result.outcome === "failed") return deps.store.releaseFailedPayment(actor, booking.id, paymentAttemptId);
  if (booking.provider === "mock" && result.outcome === "created") return deps.store.update(actor, booking.id, orderValues(OrderReceiptSchema.parse(result.data)));
  // A successful payment response is insufficient: retrieve the order's paid_at before confirming.
  return reconcileBooking(actor, claimed.booking, deps);
}
