import { and, eq } from "drizzle-orm";
import { cases, searches, fareSnapshots, CaseError } from "@/domains/case/server";
import { getDb, withActor, type Actor, type Db } from "@/shared/lib/db";
import { bookings, coordinatorTasks, type Booking } from "./db";
import { canApplyBookingStatus } from "./bookingStatus";
import { HttpError } from "@/shared/lib/http";
export function createBookingStore(db: Db) {
  async function owned(actor: Actor, id: string) {
    const [row] = await db.select({ booking: bookings }).from(bookings).innerJoin(cases, eq(bookings.caseId, cases.id)).where(and(eq(bookings.id, id), eq(cases.ownerId, actor.id)));
    if (!row) throw new CaseError("not_found", 404); return row.booking;
  }
  async function attempt(actor: Actor, id: string) {
    const [row] = await db.select({ booking: bookings }).from(bookings).innerJoin(cases, eq(bookings.caseId, cases.id)).where(and(eq(bookings.attemptId, id), eq(cases.ownerId, actor.id)));
    return row?.booking ?? null;
  }
  async function list(actor: Actor, caseId: string) {
    const [own] = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id)));
    if (!own) throw new CaseError("not_found", 404);
    return db.select().from(bookings).where(eq(bookings.caseId, caseId));
  }
  async function snapshot(actor: Actor, caseId: string, searchId: string, offerId: string) {
    const [row] = await db.select({ fare: fareSnapshots }).from(fareSnapshots).innerJoin(searches, eq(fareSnapshots.searchId, searches.id)).innerJoin(cases, eq(searches.caseId, cases.id))
      .where(and(eq(cases.ownerId, actor.id), eq(cases.id, caseId), eq(searches.id, searchId), eq(fareSnapshots.offerId, offerId)));
    if (!row) throw new CaseError("not_found", 404);
    if (row.fare.expiresAt.getTime() <= Date.now()) throw new HttpError(410, "offer_gone");
    return row.fare;
  }
  async function claim(actor: Actor, values: typeof bookings.$inferInsert) {
    return withActor(db, actor, async (tx) => {
      const [own] = await tx.select().from(cases).where(and(eq(cases.id, values.caseId), eq(cases.ownerId, actor.id))).for("update");
      if (!own) throw new CaseError("not_found", 404);
      const [existing] = await tx.select().from(bookings).where(eq(bookings.attemptId, values.attemptId));
      if (existing) {
        if (existing.bookedBy !== actor.id || existing.requestHash !== values.requestHash) throw new HttpError(409, "attempt_conflict");
        return { booking: existing, claimed: false };
      }
      const active = await tx.select().from(bookings).where(and(eq(bookings.caseId, values.caseId), eq(bookings.resource, values.resource ?? "flight")));
      if (active.some((b) => !["failed", "cancelled", "expired"].includes(b.status))) throw new HttpError(409, "booking_exists");
      const [booking] = await tx.insert(bookings).values(values).returning();
      return { booking, claimed: true };
    });
  }
  async function update(actor: Actor, id: string, values: Partial<typeof bookings.$inferInsert>, task?: string) {
    return withActor(db, actor, async (tx) => {
      const [current] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
      if (!current) throw new CaseError("not_found", 404);
      if (actor.type !== "system") {
        const [own] = await tx.select().from(cases).where(and(eq(cases.id, current.caseId), eq(cases.ownerId, actor.id)));
        if (!own) throw new CaseError("not_found", 404);
      }
      // Reconciliation and old events cannot undo successful payment/cancellation or operator requests.
      if (values.status && !canApplyBookingStatus(current.status, values.status)) values = {};
      const [row] = await tx.update(bookings).set({ ...values, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      if (row.status === "confirmed" && row.resource === "flight") await tx.update(cases).set({ status: "booked", updatedAt: new Date() }).where(eq(cases.id, row.caseId));
      if (task) await tx.insert(coordinatorTasks).values({ bookingId: id, kind: task }).onConflictDoNothing();
      return row;
    });
  }
  async function claimPayment(actor: Actor, id: string, paymentAttemptId: string) {
    await owned(actor, id);
    return withActor(db, actor, async (tx) => {
      const [row] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
      if (row.status !== "held" || row.paymentAttemptId) return { booking: row, claimed: false };
      const [booking] = await tx.update(bookings).set({ status: "payment_checking", paymentAttemptId, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      return { booking, claimed: true };
    });
  }
  async function releaseFailedPayment(actor: Actor, id: string, paymentAttemptId: string) {
    await owned(actor, id);
    return withActor(db, actor, async (tx) => {
      const [current] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
      if (current.status !== "payment_checking" || current.paymentAttemptId !== paymentAttemptId) return current;
      const [row] = await tx.update(bookings).set({ status: "held", paymentAttemptId: null, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      return row;
    });
  }
  return { owned, attempt, list, snapshot, claim, update, claimPayment, releaseFailedPayment };
}
export type BookingStore = ReturnType<typeof createBookingStore>;
export const getBookingStore = () => createBookingStore(getDb());
export type { Booking };
