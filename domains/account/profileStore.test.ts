// Real SQL checks on disposable PostgreSQL only.
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withActor } from "@/shared/lib/db";
import { createProfileStore } from "./profileStore";

const isolated = process.env.BON_VOYAGE_ISOLATED_TESTS === "1" && !!process.env.TEST_DATABASE_OWNER_URL;
const a = { id: "profile-a", type: "user" as const };
const b = { id: "profile-b", type: "user" as const };
const profile = { displayName: "Synthetic Patient", accountKind: "patient" as const, residenceCountry: "US", preferredLanguage: "en", timeZone: "America/Los_Angeles", adultConfirmed: true as const };
describe.skipIf(!isolated)("encrypted profile and country gate", () => {
  let owner: ReturnType<typeof createDb>; let app: ReturnType<typeof createDb>; let store: ReturnType<typeof createProfileStore>;
  const previousGate = process.env.REAL_PATIENT_DATA_ENABLED;
  beforeAll(async () => {
    owner = createDb(process.env.TEST_DATABASE_OWNER_URL!, 2);
    await owner.db.execute(sql`drop schema if exists audit cascade; drop schema if exists drizzle cascade; drop schema public cascade; create schema public; grant usage on schema public to bv_app`);
    await migrate(owner.db, { migrationsFolder: fileURLToPath(new URL("../../shared/lib/db/migrations", import.meta.url)) });
    app = createDb(process.env.TEST_DATABASE_URL!, 5);
    store = createProfileStore(app.db, { current: 1, keys: { 1: randomBytes(32) } });
    await withActor(app.db, { id: "setup", type: "system" }, (tx) => tx.execute(sql`insert into "user" (id, name, email, email_verified) values ('profile-a','Fake A','profile-a@example.com',true),('profile-b','Fake B','profile-b@example.com',true)`));
  });
  afterAll(async () => { process.env.REAL_PATIENT_DATA_ENABLED = previousGate; await app?.pool.end(); await owner?.pool.end(); });
  it("encrypts the profile, limits reads to the owner and rejects stale revisions", async () => {
    expect((await store.save(a, { revision: 0, profile })).revision).toBe(1);
    expect((await store.load(a)).profile).toEqual(profile);
    expect((await store.load(b)).profile).toBeNull();
    await expect(store.save(a, { revision: 0, profile })).rejects.toMatchObject({ status: 409 });
    const raw = JSON.stringify((await owner.db.execute(sql`select * from account_profile`)).rows);
    expect(raw).not.toContain(profile.displayName);
    const log = JSON.stringify((await app.db.execute(sql`select changed from audit.log where table_name='account_profile'`)).rows);
    expect(log).not.toContain(profile.displayName); expect(log).toContain("redacted");
  });
  it("keeps real intake off until global, regional and current consent gates pass", async () => {
    expect((await store.eligibility(a)).active).toBe(false);
    process.env.REAL_PATIENT_DATA_ENABLED = "true";
    expect((await store.eligibility(a)).reason).toBe("region_unavailable");
    await withActor(app.db, { id: "operator", type: "system" }, (tx) => tx.execute(sql`insert into jurisdiction_release (country_code, policy_version, enabled, approved_by, approved_at, expires_at) values ('US','review-v1',true,'synthetic-operator',now(),now() + interval '1 day')`));
    expect((await store.eligibility(a)).reason).toBe("consent_required");
    await expect(store.acceptHealthConsent(a, "wrong-version")).rejects.toMatchObject({ status: 403 });
    await store.acceptHealthConsent(a, "review-v1");
    expect((await store.eligibility(a)).active).toBe(true);
    await store.withdrawHealthConsent(a);
    expect((await store.eligibility(a)).active).toBe(false);
    await expect(store.acceptHealthConsent(b, "review-v1")).rejects.toMatchObject({ status: 403 });
    process.env.REAL_PATIENT_DATA_ENABLED = "false";
  });
  it("records owner-scoped data requests without automatic deletion", async () => {
    const first = await store.requestData(a, { kind: "delete" });
    expect((await store.requestData(a, { kind: "delete" })).id).toBe(first.id);
    expect((await store.listDataRequests(a))[0]).toMatchObject({ kind: "delete", status: "pending" });
    expect(await store.listDataRequests(b)).toEqual([]);
    expect((await app.db.execute(sql`select * from audit.verify()`)).rows[0]).toMatchObject({ first_bad_id: null });
  });
});
