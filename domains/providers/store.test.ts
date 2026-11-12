// Destructive setup is confined to tooling/testDatabase.py's disposable private database.
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withActor } from "@/shared/lib/db";
import { OFFERS } from "./archivedSampleOffers";
import { createCarePlanStore } from "./store";
import type { CarePlanDraft, SavedCarePlan } from "./plan";

const isolated = process.env.BON_VOYAGE_ISOLATED_TESTS === "1" && !!process.env.TEST_DATABASE_OWNER_URL;
const actor = { id: "care-owner", type: "user" as const };
const stranger = { id: "care-stranger", type: "user" as const };
describe.skipIf(!isolated)("encrypted care plans and requests (isolated database)", () => {
  let owner: ReturnType<typeof createDb>; let app: ReturnType<typeof createDb>; let store: ReturnType<typeof createCarePlanStore>;
  let plan: SavedCarePlan;
  const draft: CarePlanDraft = { offerId: OFFERS[0].id, from: "", out: "", back: "", travellers: 1, flightId: null, stayQuoteId: null };
  beforeAll(async () => {
    owner = createDb(process.env.TEST_DATABASE_OWNER_URL!, 2);
    await owner.db.execute(sql`drop schema if exists audit cascade; drop schema if exists drizzle cascade; drop schema public cascade; create schema public; grant usage on schema public to bv_app`);
    await migrate(owner.db, { migrationsFolder: fileURLToPath(new URL("../../shared/lib/db/migrations", import.meta.url)) });
    app = createDb(process.env.TEST_DATABASE_URL!, 5);
    store = createCarePlanStore(app.db, { current: 1, keys: { 1: randomBytes(32) } });
    await withActor(app.db, { id: "setup", type: "system" }, (tx) => tx.execute(sql`insert into "user" (id, name, email) values ('care-owner', 'FAKE OWNER', 'care-owner@example.com'), ('care-stranger', 'FAKE OTHER', 'care-stranger@example.com')`));
  });
  afterAll(async () => { await app?.pool.end(); await owner?.pool.end(); });
  it("encrypts treatment and route data and enforces owner and version checks", async () => {
    plan = await store.savePlan(actor, { draft });
    expect(plan.revision).toBe(1);
    expect((await store.loadPlan(actor, plan.id)).draft).toEqual(draft);
    expect(await store.listPlans(stranger)).toEqual([]);
    await expect(store.loadPlan(stranger, plan.id)).rejects.toMatchObject({ status: 404 });
    await expect(store.savePlan(stranger, { id: plan.id, revision: 1, draft })).rejects.toMatchObject({ status: 404 });
    await expect(store.savePlan(actor, { id: plan.id, revision: 2, draft })).rejects.toMatchObject({ status: 409 });
    const raw = JSON.stringify((await owner.db.execute(sql`select * from care_plans`)).rows);
    expect(raw).not.toContain(draft.offerId);
    const log = JSON.stringify((await app.db.execute(sql`select changed from audit.log where table_name='care_plans'`)).rows);
    expect(log).not.toContain(draft.offerId); expect(log).toContain("redacted");
    await expect(app.db.execute(sql`update care_plans set revision=9 where id=${plan.id}`)).rejects.toThrow();
  });
  it("deduplicates concurrent and repeated requests even with new attempt ids or no-op saves", async () => {
    const unchanged = await store.savePlan(actor, { id: plan.id, revision: plan.revision, draft });
    expect(unchanged.revision).toBe(plan.revision);
    const input = { planId: plan.id, revision: plan.revision, attemptId: randomUUID() };
    const [first, second] = await Promise.all([store.requestCare(actor, input), store.requestCare(actor, { ...input, attemptId: randomUUID() })]);
    expect(first.id).toBe(second.id); expect(first.status).toBe("sample"); expect(first.message).toContain("No clinic was contacted");
    expect((await store.requestCare(actor, input)).id).toBe(first.id);
    expect(await store.listRequests(stranger)).toEqual([]);
    expect(await store.listRequests(actor)).toHaveLength(1);
    await expect(store.requestCare(stranger, input)).rejects.toMatchObject({ status: 404 });
    const raw = JSON.stringify((await owner.db.execute(sql`select * from care_requests`)).rows);
    expect(raw).not.toContain(draft.offerId); expect(raw).not.toContain(OFFERS[0].providerName);
  });
  it("retains request snapshots when the original plan changes", async () => {
    plan = await store.savePlan(actor, { id: plan.id, revision: plan.revision, draft: { ...draft, offerId: OFFERS[1].id } });
    expect(plan.revision).toBe(2);
    const requests = await store.listRequests(actor);
    expect(requests[0].draft.offerId).toBe(draft.offerId);
    expect(requests[0].providerName).toBe(OFFERS[0].providerName);
    await expect(store.requestCare(actor, { planId: plan.id, revision: 1, attemptId: randomUUID() })).resolves.toMatchObject({ planRevision: 1 });
    expect((await app.db.execute(sql`select * from audit.verify()`)).rows[0]).toMatchObject({ first_bad_id: null });
  });
  it("rejects invented and expired selections before persistence", async () => {
    await expect(store.savePlan(actor, { draft: { ...draft, offerId: "unlisted-care" } })).rejects.toMatchObject({ status: 400 });
    await expect(store.savePlan(actor, { draft: { ...draft, from: "JFK", out: "2020-01-01", back: "2020-01-10" } })).rejects.toMatchObject({ status: 409 });
    await expect(store.savePlan(actor, { draft: { ...draft, from: "JFK", out: "2027-01-01", back: "2027-01-10", flightId: "invented" } })).rejects.toMatchObject({ status: 409 });
  });
});
