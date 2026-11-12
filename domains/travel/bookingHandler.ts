import { z, ZodError } from "zod/v4";
import type { Actor } from "@/shared/lib/db";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { CaseError } from "@/domains/case/server";
import { createMockProvider } from "./mockProvider";
import { getFlightProvider, getBookingStore, createOrderProvider } from "./server";
import { bookFlight, payHold, quoteFlight, reconcileBooking, type BookingDependencies } from "./booking";
const quote = z.object({ action: z.literal("quote"), caseId: z.uuid(), searchId: z.uuid(), offerId: z.string().max(250) }).strict();
const operation = z.object({ action: z.enum(["reconcile", "cancel", "pay"]), bookingId: z.uuid(), paymentAttemptId: z.uuid().optional(), expectedAmount: z.number().finite().nonnegative().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional() }).strict();
export function getBookingDependencies(readOnly = false): BookingDependencies {
  const provider = readOnly ? createMockProvider() : getFlightProvider();
  if (provider.name === "duffel" && process.env.DUFFEL_BOOKING_ENABLED !== "true") throw new HttpError(503, "booking_not_enabled");
  if (provider.mode === "live") throw new HttpError(403, "live_booking_requires_release");
  const secret = process.env.DATA_KEY;
  if (!secret && !readOnly) throw new HttpError(503, "booking_not_configured");
  return { provider, orders: createOrderProvider(readOnly ? undefined : process.env.DUFFEL_ACCESS_TOKEN), store: getBookingStore(), hashSecret: secret ?? "read-only-unused" };
}
export function createBookingHandlers(actorFrom: (headers: Headers) => Promise<Actor | null>, dependencies = getBookingDependencies) {
  async function handle(request: Request, action: (actor: Actor, deps: BookingDependencies) => Promise<unknown>) {
    try {
      const actor = await actorFrom(request.headers);
      if (!actor) throw new HttpError(401, "unauthorized");
      if (request.method !== "GET") requireSameOrigin(request);
      return privateJson(await action(actor, dependencies(request.method === "GET")));
    } catch (error) {
      if (error instanceof ZodError) return privateJson({ error: "invalid_request" }, 400);
      if (error instanceof HttpError || error instanceof CaseError) return privateJson({ error: error.code }, error.status);
      return privateJson({ error: "temporarily_unavailable" }, 503);
    }
  }
  return {
    GET: (request: Request) => handle(request, async (actor, deps) => ({ bookings: (await deps.store.list(actor, z.uuid().parse(new URL(request.url).searchParams.get("caseId")))).filter((b) => b.resource === "flight") })),
    POST: (request: Request) => handle(request, async (actor, deps) => {
      const body = await readJson(request, 24000) as Record<string, unknown>;
      if (body.action === "quote") { const input = quote.parse(body); return { fare: await quoteFlight(actor, input, deps), mode: deps.provider.mode ?? "sample" }; }
      if (body.action === "reconcile" || body.action === "pay" || body.action === "cancel") {
        const input = operation.parse(body);
        const booking = await deps.store.owned(actor, input.bookingId);
        if (booking.provider !== deps.provider.name) throw new HttpError(409, "provider_changed");
        if (input.action === "reconcile") return reconcileBooking(actor, booking, deps);
        if (input.action === "cancel") {
          if (!["confirmed", "held", "cancel_requested"].includes(booking.status)) throw new HttpError(409, "cancellation_unavailable");
          return deps.store.update(actor, booking.id, { status: "cancel_requested" }, "manual_cancellation");
        }
        if (!input.paymentAttemptId || input.expectedAmount === undefined || !input.currency) throw new HttpError(400, "invalid_request");
        return payHold(actor, booking, input.expectedAmount, input.currency, input.paymentAttemptId, deps);
      }
      return bookFlight(actor, body, deps);
    }),
  };
}
