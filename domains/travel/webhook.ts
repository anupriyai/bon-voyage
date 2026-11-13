import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { getDb, withActor } from "@/shared/lib/db";
import { HttpError, privateJson } from "@/shared/lib/http";
import { bookings, coordinatorTasks, webhookEvents } from "./db";
import { OrderReceiptSchema } from "./duffelTransport";
import { orderValues } from "./booking";
export function verifyDuffelSignature(body: Uint8Array, header: string | null, secret: string, now = Date.now()) {
  if (!header || !secret) return false;
  const entries = header.split(",").map((s) => s.trim());
  const timestamp = entries.find((s) => s.startsWith("t="))?.slice(2);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(body).digest();
  return entries.filter((s) => s.startsWith("v1=")).some((s) => {
    const hex = s.slice(3); if (!/^[0-9a-f]{64}$/.test(hex)) return false;
    const actual = Buffer.from(hex, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
const eventSchema = z.object({ id: z.string().max(250), type: z.string().max(250), idempotency_key: z.string().max(250), live_mode: z.boolean(), data: z.object({ object: z.record(z.string(), z.unknown()) }) });
export async function duffelWebhook(request: Request) {
  try {
    const secret = process.env.DUFFEL_WEBHOOK_SECRET;
    const token = process.env.DUFFEL_ACCESS_TOKEN;
    if (!secret || !token) throw new HttpError(503, "webhook_not_configured");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "invalid_request");
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 256000) { await reader.cancel(); throw new HttpError(413, "body_too_large"); } chunks.push(part.value); }
    } finally { reader.releaseLock(); }
    const body = Buffer.concat(chunks);
    if (!verifyDuffelSignature(body, request.headers.get("x-duffel-signature"), secret)) throw new HttpError(401, "invalid_signature");
    const event = eventSchema.parse(JSON.parse(body.toString("utf8")));
    if (event.live_mode !== token.startsWith("duffel_live_")) throw new HttpError(400, "mode_mismatch");
    if (!["order.created", "order.airline_initiated_change_detected", "stays.booking.created"].includes(event.type)) return privateJson({ received: true, ignored: true });
    const object = event.data.object;
    const orderId = typeof object.order_id === "string" ? object.order_id : typeof object.id === "string" ? object.id : "";
    const metadata = object.metadata as Record<string, unknown> | undefined;
    const attempt = z.uuid().safeParse(metadata?.attempt_id);
    const db = getDb();
    const result = await withActor(db, { type: "system", id: "duffel-webhook" }, async (tx) => {
      const [booking] = await tx.select().from(bookings).where(and(eq(bookings.provider, "duffel"), or(eq(bookings.orderId, orderId), ...(attempt.success ? [eq(bookings.attemptId, attempt.data)] : [])))).for("update");
      if (!booking || (booking.orderId && booking.orderId !== orderId)) return { ignored: true };
      const [inserted] = await tx.insert(webhookEvents).values({ provider: "duffel", eventType: event.type, eventKey: event.idempotency_key, eventId: event.id }).onConflictDoNothing().returning();
      if (!inserted) return { duplicate: true };
      if (event.type === "stays.booking.created") {
        if (booking.resource !== "stay") throw new HttpError(400, "order_mismatch");
        const stay = z.object({ id: z.string(), status: z.enum(["confirmed", "cancelled"]), reference: z.string().nullable(), metadata: z.record(z.string(), z.string()).nullable() }).parse(object);
        if (stay.metadata?.attempt_id !== booking.attemptId) throw new HttpError(400, "order_mismatch");
        if (!["confirmed", "cancelled", "cancel_requested"].includes(booking.status)) await tx.update(bookings).set({ orderId: stay.id, bookingReference: stay.reference, status: stay.status, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
        if (booking.details.assistance) await tx.insert(coordinatorTasks).values({ bookingId: booking.id, kind: "accommodation_accessibility" }).onConflictDoNothing();
      } else if (event.type === "order.airline_initiated_change_detected") {
        await tx.update(bookings).set({ scheduleChanged: true, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
        await tx.insert(coordinatorTasks).values({ bookingId: booking.id, kind: "schedule_review" }).onConflictDoNothing();
      } else {
        const order = OrderReceiptSchema.parse(object);
        if (order.metadata.attempt_id !== booking.attemptId) throw new HttpError(400, "order_mismatch");
        if (!["confirmed", "cancelled", "cancel_requested", "payment_checking"].includes(booking.status)) {
          await tx.update(bookings).set({ ...orderValues(order), updatedAt: new Date() }).where(eq(bookings.id, booking.id));
        }
        if (booking.details.assistance) await tx.insert(coordinatorTasks).values({ bookingId: booking.id, kind: "airline_assistance" }).onConflictDoNothing();
      }
      return { updated: true };
    });
    return privateJson({ received: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) return privateJson({ error: error.code }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return privateJson({ error: "invalid_event" }, 400);
    return privateJson({ error: "temporarily_unavailable" }, 503);
  }
}
