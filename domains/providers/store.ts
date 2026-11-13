// Server surface only. Never export this repository from the browser catalogue entry point.
import { randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { getDb, loadKeyRing, open, seal, withActor, type Actor, type Db, type KeyRing, type Tx } from "@/shared/lib/db";
import { verifyCareTravelSelection } from "@/domains/travel/server";
import { type CareOffer } from "./catalogue";
import { findOffer } from "./archivedSampleOffers";
import { carePlans, careRequests } from "./db";
import { CarePlanSchema, CareRequestSchema, SaveCarePlanSchema, SAMPLE_REQUEST_MESSAGE, type CarePlanDraft, type CareRequest, type SavedCarePlan } from "./plan";

export class CarePlanError extends Error {
  constructor(public code: "not_found" | "conflict" | "invalid_request" | "selection_expired" | "unauthorized", public status: number) { super(code); }
}
type PlanRow = typeof carePlans.$inferSelect;
type RequestRow = typeof careRequests.$inferSelect;
type Snapshot = { draft: CarePlanDraft; offer: CareOffer; travel: unknown };
function requireUser(actor: Actor) { if (actor.type !== "user" || !actor.id) throw new CarePlanError("unauthorized", 401); }
const context = (kind: string, id: string) => `care-${kind}/${id}`;

export function createCarePlanStore(db: Db, ring: KeyRing, verifyTravel = verifyCareTravelSelection) {
  function unpack(row: PlanRow): SavedCarePlan {
    return { id: row.id, revision: row.revision, draft: CarePlanSchema.parse(JSON.parse(open(row, context("plan", row.id), ring))), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
  function unpackRequest(row: RequestRow): CareRequest {
    const snapshot = JSON.parse(open(row, context("request", row.id), ring)) as Snapshot;
    return { id: row.id, planId: row.planId, planRevision: row.planRevision, status: "sample", createdAt: row.createdAt.toISOString(), message: SAMPLE_REQUEST_MESSAGE, draft: CarePlanSchema.parse(snapshot.draft), providerName: snapshot.offer.providerName };
  }
  async function owned(queryDb: Db | Tx, actor: Actor, id: string, lock = false) {
    requireUser(actor); z.uuid().parse(id);
    const query = queryDb.select().from(carePlans).where(and(eq(carePlans.id, id), eq(carePlans.ownerId, actor.id)));
    const [row] = lock ? await query.for("update") : await query;
    if (!row) throw new CarePlanError("not_found", 404);
    return row;
  }
  async function checked(draft: CarePlanDraft) {
    const offer = findOffer(draft.offerId);
    if (!offer) throw new CarePlanError("invalid_request", 400);
    try { return { offer, travel: await verifyTravel(draft) }; }
    catch { throw new CarePlanError("selection_expired", 409); }
  }
  async function loadPlan(actor: Actor, id: string) { return unpack(await owned(db, actor, id)); }
  async function listPlans(actor: Actor) {
    requireUser(actor);
    return (await db.select().from(carePlans).where(eq(carePlans.ownerId, actor.id)).orderBy(desc(carePlans.updatedAt))).map(unpack);
  }
  async function listRequests(actor: Actor) {
    requireUser(actor);
    return (await db.select().from(careRequests).where(eq(careRequests.ownerId, actor.id)).orderBy(desc(careRequests.createdAt))).map(unpackRequest);
  }
  async function savePlan(actor: Actor, value: unknown) {
    requireUser(actor);
    const input = SaveCarePlanSchema.parse(value);
    // Reprice sample selections outside the audited transaction. Client-submitted prices are never accepted.
    await checked(input.draft);
    const id = input.id ?? randomUUID();
    return withActor(db, actor, async (tx) => {
      const [previous] = await tx.select().from(carePlans).where(eq(carePlans.id, id)).for("update");
      if (previous && previous.ownerId !== actor.id) throw new CarePlanError("not_found", 404);
      if (previous ? previous.revision !== input.revision : input.revision != null) throw new CarePlanError("conflict", 409);
      if (previous && JSON.stringify(unpack(previous).draft) === JSON.stringify(input.draft)) return unpack(previous);
      const encrypted = seal(JSON.stringify(input.draft), context("plan", id), ring);
      const [row] = previous
        ? await tx.update(carePlans).set({ ...encrypted, revision: previous.revision + 1, updatedAt: new Date() }).where(and(eq(carePlans.id, id), eq(carePlans.ownerId, actor.id))).returning()
        : await tx.insert(carePlans).values({ id, ownerId: actor.id, ...encrypted }).returning();
      return unpack(row);
    });
  }
  async function requestCare(actor: Actor, value: unknown) {
    requireUser(actor);
    const input = CareRequestSchema.parse(value);
    const matches = and(eq(careRequests.ownerId, actor.id), or(eq(careRequests.attemptId, input.attemptId), and(eq(careRequests.planId, input.planId), eq(careRequests.planRevision, input.revision))));
    const [existing] = await db.select().from(careRequests).where(matches);
    if (existing) {
      if (existing.planId !== input.planId || existing.planRevision !== input.revision) throw new CarePlanError("conflict", 409);
      return unpackRequest(existing);
    }
    const current = await loadPlan(actor, input.planId);
    if (current.revision !== input.revision) throw new CarePlanError("conflict", 409);
    const verified = await checked(current.draft);
    const id = randomUUID();
    const snapshot: Snapshot = { draft: current.draft, offer: verified.offer, travel: verified.travel };
    return withActor(db, actor, async (tx) => {
      // Audit lock serializes concurrent requests; re-check both version and idempotency inside it.
      const row = await owned(tx, actor, input.planId, true);
      const [duplicate] = await tx.select().from(careRequests).where(matches);
      if (duplicate) {
        if (duplicate.planId !== input.planId || duplicate.planRevision !== input.revision) throw new CarePlanError("conflict", 409);
        return unpackRequest(duplicate);
      }
      if (row.revision !== input.revision) throw new CarePlanError("conflict", 409);
      const [request] = await tx.insert(careRequests).values({ id, ownerId: actor.id, planId: input.planId, planRevision: input.revision, attemptId: input.attemptId, ...seal(JSON.stringify(snapshot), context("request", id), ring) }).returning();
      return unpackRequest(request);
    });
  }
  return { loadPlan, listPlans, listRequests, savePlan, requestCare };
}
export type CarePlanStore = ReturnType<typeof createCarePlanStore>;
export function getCarePlanStore() { return createCarePlanStore(getDb(), loadKeyRing()); }
