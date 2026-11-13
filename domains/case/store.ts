// Server-only case repository. The browser-safe domains/case/index.ts must never export this module.
import { and, desc, eq } from "drizzle-orm";
import { getDb, loadKeyRing, open, seal, withActor, type Actor, type Db, type KeyRing, type Tx } from "@/shared/lib/db";
import { cases, caseClinical, travelers } from "./db";
import { CaseIdSchema, CaseStateSchema, SaveCaseSchema, TravelerSchema, type SaveCaseInput, type TravelerInput } from "./model/persistence";
import type { CaseState } from "./model/caseState";

export class CaseError extends Error {
  constructor(public code: "not_found" | "conflict" | "invalid" | "unauthorized", public status: number) { super(code); }
}
export interface OwnedCase {
  state: CaseState;
  revision: number;
  record: typeof cases.$inferSelect;
  travelers: (typeof travelers.$inferSelect)[];
}
const MAX_BYTES = 256_000;
function userActor(actor: Actor) {
  if (!actor.id || actor.type !== "user") throw new CaseError("unauthorized", 401);
}

export function createCaseStore(db: Db, ring: KeyRing) {
  async function owned(tx: Db | Tx, actor: Actor, id: string, lock = false) {
    userActor(actor);
    CaseIdSchema.parse(id);
    const query = tx.select().from(cases).where(and(eq(cases.id, id), eq(cases.ownerId, actor.id)));
    const [row] = lock ? await query.for("update") : await query;
    if (!row) throw new CaseError("not_found", 404);
    return row;
  }
  async function loadCase(actor: Actor, id: string): Promise<OwnedCase> {
    const record = await owned(db, actor, id);
    const [clinical] = await db.select().from(caseClinical).where(eq(caseClinical.caseId, record.id));
    if (!clinical) throw new CaseError("not_found", 404);
    const state = CaseStateSchema.parse(JSON.parse(open(clinical, id, ring)));
    return { state, record, revision: record.revision, travelers: await db.select().from(travelers).where(eq(travelers.caseId, record.id)) };
  }
  async function listCases(actor: Actor): Promise<OwnedCase[]> {
    userActor(actor);
    // Both clinical details and the record are selected under one ownership predicate.
    const rows = await db.select({ record: cases, clinical: caseClinical }).from(cases)
      .innerJoin(caseClinical, eq(caseClinical.caseId, cases.id)).where(eq(cases.ownerId, actor.id)).orderBy(desc(cases.updatedAt));
    return rows.map(({ record, clinical }) => ({ state: CaseStateSchema.parse(JSON.parse(open(clinical, record.id, ring))), record, revision: record.revision, travelers: [] }));
  }
  async function write(tx: Tx, actor: Actor, input: SaveCaseInput): Promise<OwnedCase> {
    const { state, revision, schedule } = input;
    // The global audit lock held by withActor serializes competing creates and updates as well.
    const [previous] = await tx.select().from(cases).where(eq(cases.id, state.id)).for("update");
    if (previous && previous.ownerId !== actor.id) throw new CaseError("not_found", 404);
    if (previous ? revision !== previous.revision : revision !== null) throw new CaseError("conflict", 409);
    const now = new Date();
    const copy = { ...state, updatedAt: now.toISOString() };
    const values = {
      originCity: state.intake.originCity || state.intake.originOther || state.intake.origin,
      hospitalId: state.chosenId,
      status: previous && ["booked", "travelling", "done"].includes(previous.status) ? previous.status : state.chosenId ? "planning" as const : state.complete ? "matching" as const : "draft" as const,
      updatedAt: now, revision: (previous?.revision ?? 0) + 1,
      ...(state.travelSchedule ? { appointmentDate: state.travelSchedule.appointment, treatmentDays: state.travelSchedule.treatmentDays, recoveryDays: state.travelSchedule.recoveryDays } : {}),
      ...(schedule ?? {}),
    };
    const [record] = previous
      ? await tx.update(cases).set(values).where(and(eq(cases.id, state.id), eq(cases.ownerId, actor.id))).returning()
      : await tx.insert(cases).values({ ...values, id: state.id, ownerId: actor.id }).returning();
    const encrypted = seal(JSON.stringify(copy), state.id, ring);
    await tx.insert(caseClinical).values({ caseId: state.id, ...encrypted, updatedAt: now })
      .onConflictDoUpdate({ target: caseClinical.caseId, set: { ...encrypted, updatedAt: now } });
    return { state: copy, record, revision: record.revision, travelers: await tx.select().from(travelers).where(eq(travelers.caseId, record.id)) };
  }
  async function saveCase(actor: Actor, value: unknown): Promise<OwnedCase> {
    userActor(actor);
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BYTES) throw new CaseError("invalid", 413);
    const input = SaveCaseSchema.parse(value);
    if (input.state.sample) throw new CaseError("invalid", 400);
    return withActor(db, actor, (tx) => write(tx, actor, input));
  }
  async function saveClinical(actor: Actor, id: string, clinical: Pick<CaseState, "intake" | "health">, revision: number): Promise<OwnedCase> {
    const current = await loadCase(actor, id);
    return saveCase(actor, { state: { ...current.state, intake: clinical.intake, health: clinical.health }, revision });
  }
  async function addTraveler(actor: Actor, id: string, value: TravelerInput) {
    userActor(actor);
    const input = TravelerSchema.parse(value);
    return withActor(db, actor, async (tx) => {
      await owned(tx, actor, id, true);
      const existing = await tx.select({ id: travelers.id }).from(travelers).where(eq(travelers.caseId, id));
      if (existing.length >= 9) throw new CaseError("invalid", 400);
      const [traveler] = await tx.insert(travelers).values({ ...input, caseId: id }).returning();
      return traveler;
    });
  }
  async function deleteCase(actor: Actor, id: string, revision: number) {
    userActor(actor);
    await withActor(db, actor, async (tx) => {
      const current = await owned(tx, actor, id, true);
      if (current.revision !== revision) throw new CaseError("conflict", 409);
      await tx.delete(cases).where(and(eq(cases.id, id), eq(cases.ownerId, actor.id)));
    });
  }
  return { saveCase, loadCase, listCases, saveClinical, addTraveler, deleteCase };
}
export type CaseStore = ReturnType<typeof createCaseStore>;
export const getCaseStore = () => createCaseStore(getDb(), loadKeyRing());
