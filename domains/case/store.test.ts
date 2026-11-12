// Destructive setup is permitted only inside tooling/testDatabase.py's disposable cluster.
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withActor } from "@/shared/lib/db";
import { createCaseStore } from "./store";
import { initialState } from "./model/caseState";
import { createSearchStore } from "@/domains/travel/server";
import { createMockProvider } from "@/domains/travel";

const isolated = process.env.BON_VOYAGE_ISOLATED_TESTS === "1" && !!process.env.TEST_DATABASE_OWNER_URL;
const id = "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36";
const actor = { id: "case-owner", type: "user" as const };
const stranger = { id: "another-owner", type: "user" as const };
describe.skipIf(!isolated)("case and search persistence (isolated database)", () => {
  let owner: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  let store: ReturnType<typeof createCaseStore>;
  let searches: ReturnType<typeof createSearchStore>;
  beforeAll(async () => {
    owner = createDb(process.env.TEST_DATABASE_OWNER_URL!, 2);
    await owner.db.execute(sql`drop schema if exists audit cascade; drop schema if exists drizzle cascade; drop schema public cascade; create schema public; grant usage on schema public to bv_app`);
    await migrate(owner.db, { migrationsFolder: fileURLToPath(new URL("../../shared/lib/db/migrations", import.meta.url)) });
    app = createDb(process.env.TEST_DATABASE_URL!, 5);
    store = createCaseStore(app.db, { current: 1, keys: { 1: randomBytes(32) } });
    searches = createSearchStore(app.db);
    await withActor(app.db, { id: "setup", type: "system" }, (tx) => tx.execute(sql`insert into "user" (id, name, email) values ('case-owner', 'Test owner', 'case-owner@example.com'), ('another-owner', 'Test other', 'another-owner@example.com')`));
  });
  afterAll(async () => { await app?.pool.end(); await owner?.pool.end(); });
  it("round-trips the full case encrypted, attributes saves, and rejects other owners", async () => {
    const state = initialState(id);
    state.intake = { ...state.intake, patientName: "FAKE CLINICAL NAME", diagnosisOther: "FAKE CLINICAL STORY" };
    state.health = { medication: "FAKE HEALTH ANSWER" };
    const saved = await store.saveCase(actor, { state, revision: null });
    expect(saved.revision).toBe(1);
    expect((await store.loadCase(actor, id)).state.health).toEqual(state.health);
    expect(await store.listCases(stranger)).toEqual([]);
    await expect(store.loadCase(stranger, id)).rejects.toMatchObject({ status: 404 });
    await expect(store.saveCase(stranger, { state, revision: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(store.saveCase(actor, { state, revision: null })).rejects.toMatchObject({ status: 409 });
    const raw = JSON.stringify((await owner.db.execute(sql`select * from case_clinical`)).rows);
    const log = JSON.stringify((await app.db.execute(sql`select actor_id, table_name, changed from audit.log`)).rows);
    for (const secret of ["FAKE CLINICAL NAME", "FAKE CLINICAL STORY", "FAKE HEALTH ANSWER"]) { expect(raw).not.toContain(secret); expect(log).not.toContain(secret); }
    expect(log).toContain("case-owner"); expect(log).toContain("redacted");
    await store.saveClinical(actor, id, { intake: state.intake, health: { medication: "UPDATED FAKE ANSWER" } }, 1);
    expect((await store.loadCase(actor, id)).revision).toBe(2);
  });
  it("audits traveler writes, validates fields and blocks cross-owner additions", async () => {
    await expect(store.addTraveler(stranger, id, { role: "patient", givenName: "FAKE", familyName: "PATIENT", needs: [] })).rejects.toMatchObject({ status: 404 });
    await store.addTraveler(actor, id, { role: "patient", givenName: "FAKE NAME", familyName: "FAKE FAMILY", needs: ["wheelchair"] });
    const log = JSON.stringify((await app.db.execute(sql`select changed from audit.log where table_name = 'travelers'`)).rows);
    expect(log).toContain("redacted"); expect(log).not.toContain("FAKE NAME");
  });
  it("reserves quota atomically, persists immutable fares and prevents unauthorized search writes", async () => {
    await expect(searches.reserve(stranger, id, 2, {}, 1)).rejects.toMatchObject({ status: 404 });
    await expect(searches.reserve(actor, id, 1, {}, 1)).rejects.toMatchObject({ status: 409 });
    const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => searches.reserve(actor, id, 2, { from: "AMM", to: "IST" }, 3)));
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(2);
    const searchId = (attempts.find((a) => a.status === "fulfilled") as PromiseFulfilledResult<string>).value;
    const fares = await createMockProvider().searchReturn({ from: "AMM", to: "IST", out: "2027-01-18", back: "2027-02-06", passengers: [{ type: "adult" }] });
    await expect(searches.snapshots(stranger, id, searchId, fares)).rejects.toMatchObject({ status: 404 });
    await searches.snapshots(actor, id, searchId, fares);
    expect((await app.db.execute(sql`select * from fare_snapshots where search_id = ${searchId}`)).rows.length).toBe(fares.length);
    await expect(app.db.execute(sql`delete from fare_snapshots`)).rejects.toThrow();
    expect((await app.db.execute(sql`select * from audit.verify()`)).rows[0]).toMatchObject({ first_bad_id: null });
  });
  it("deletes only the owned revision and leaves historical fare snapshots intact", async () => {
    await expect(store.deleteCase(stranger, id, 2)).rejects.toMatchObject({ status: 404 });
    await expect(store.deleteCase(actor, id, 1)).rejects.toMatchObject({ status: 409 });
    await store.deleteCase(actor, id, 2);
    await expect(store.loadCase(actor, id)).rejects.toMatchObject({ status: 404 });
    expect((await app.db.execute(sql`select * from fare_snapshots`)).rows.length).toBeGreaterThan(0);
    expect((await app.db.execute(sql`select * from audit.verify()`)).rows[0]).toMatchObject({ first_bad_id: null });
  });
});
