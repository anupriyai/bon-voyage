// Runs against the real test database (TEST_DATABASE_URL / TEST_DATABASE_OWNER_URL in .env.local).
// Resets it and applies the migrations first.
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, withActor, type Db } from "@/shared/lib/db/client";

const APP_URL = process.env.TEST_DATABASE_URL;
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;
const system = { id: "test", type: "system" as const };

/** The Postgres error behind Drizzle's "Failed query" wrapper, or null if it succeeded. */
async function failure(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return err.cause?.message ?? err.message;
  }
}

describe.skipIf(!APP_URL || !OWNER_URL)("audit trail (database)", () => {
  let app: ReturnType<typeof createDb>;
  let owner: ReturnType<typeof createDb>;
  let db: Db;

  const rows = async () =>
    (await db.execute(sql`select actor_id, actor_type, action, table_name, row_id, changed from audit.log order by id`)).rows as {
      actor_id: string;
      actor_type: string;
      action: string;
      table_name: string;
      row_id: string;
      changed: Record<string, unknown>;
    }[];
  const verify = async () => (await db.execute(sql`select * from audit.verify()`)).rows[0] as { checked: string; first_bad_id: string | null; head_hash: string | null };
  const newUser = (id: string) =>
    withActor(db, system, (tx) => tx.execute(sql`insert into "user" (id, name, email) values (${id}, 'Test Person', ${`${id}@example.com`})`));
  const newCase = async (ownerId: string) =>
    (await withActor(db, system, (tx) => tx.execute(sql`insert into cases (owner_id) values (${ownerId}) returning id`))).rows[0].id as string;

  beforeAll(async () => {
    owner = createDb(OWNER_URL!, 2);
    await owner.db.execute(sql`drop schema if exists audit cascade; drop schema if exists drizzle cascade; drop schema public cascade; create schema public; grant usage on schema public to bv_app`);
    await migrate(owner.db, { migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)) });
    app = createDb(APP_URL!, 5);
    db = app.db;
  });

  afterAll(async () => {
    await app?.pool.end();
    await owner?.pool.end();
  });

  beforeEach(async () => {
    // Tests need a clean log; only the owner can get past the append-only guard, and only by disabling it.
    await owner.db.execute(sql`alter table audit.log disable trigger no_truncate; truncate audit.log restart identity; alter table audit.log enable trigger no_truncate`);
    await owner.db.execute(sql`truncate "user", cases, case_clinical, travelers cascade`);
    await owner.db.execute(sql`alter table audit.log disable trigger no_truncate; truncate audit.log restart identity; alter table audit.log enable trigger no_truncate`);
  });

  it("refuses a write to an audited table without an actor", async () => {
    await newUser("u1");
    expect(await failure(db.execute(sql`insert into cases (owner_id) values ('u1')`))).toMatch(/without an actor/);
  });

  it("refuses it even on a pooled connection that ran withActor before", async () => {
    const one = createDb(APP_URL!, 1); // one connection, reused
    try {
      await withActor(one.db, system, (tx) => tx.execute(sql`insert into "user" (id, name, email) values ('u1', 'A', 'a@example.com')`));
      expect(await failure(one.db.execute(sql`insert into cases (owner_id) values ('u1')`))).toMatch(/without an actor/);
    } finally {
      await one.pool.end();
    }
  });

  it("records who changed what, with old and new values", async () => {
    await newUser("u1");
    const id = await newCase("u1");
    await withActor(db, { id: "coordinator-7", type: "user", requestId: "req-1" }, (tx) => tx.execute(sql`update cases set status = 'matching' where id = ${id}`));
    const log = await rows();
    const update = log.find((r) => r.action === "U" && r.table_name === "cases")!;
    expect(update).toMatchObject({ actor_id: "coordinator-7", actor_type: "user", row_id: id });
    expect(update.changed.status).toEqual({ old: "draft", new: "matching" });
    expect(Object.keys(update.changed)).toEqual(["status"]);
  });

  it("does not log an update that changes nothing", async () => {
    await newUser("u1");
    const id = await newCase("u1");
    const before = (await rows()).length;
    await withActor(db, system, (tx) => tx.execute(sql`update cases set status = status where id = ${id}`));
    expect((await rows()).length).toBe(before);
  });

  it("records sensitive fields by name only", async () => {
    await newUser("u1");
    const id = await newCase("u1");
    await withActor(db, system, (tx) =>
      tx.execute(sql`insert into travelers (case_id, role, given_name, family_name, born_on) values (${id}, 'patient', 'Yousef', 'Al-Masri', '1958-03-02')`),
    );
    const log = JSON.stringify(await rows());
    expect(log).not.toContain("Yousef");
    expect(log).not.toContain("Al-Masri");
    expect(log).not.toContain("1958");
    expect(log).not.toContain("example.com");
    const traveler = (await rows()).find((r) => r.table_name === "travelers")!;
    expect(traveler.changed.given_name).toEqual({ redacted: true });
    expect(traveler.changed.role).toEqual({ old: null, new: "patient" });
  });

  it("lets the app read the log but never write, change or empty it", async () => {
    await newUser("u1");
    expect(await failure(db.execute(sql`insert into audit.log (at, actor_id, actor_type, request_id, action, table_name, row_id, changed, prev_hash, hash) values (now(), 'x', 'user', 'r', 'I', 't', '1', '{}', '\\x00', '\\x00')`))).toMatch(/permission denied/);
    expect(await failure(db.execute(sql`update audit.log set actor_id = 'someone-else'`))).toMatch(/permission denied/);
    expect(await failure(db.execute(sql`delete from audit.log`))).toMatch(/permission denied/);
    expect(await failure(db.execute(sql`truncate audit.log`))).toMatch(/permission denied/);
  });

  it("blocks even the owner from editing the log while the guard is on", async () => {
    await newUser("u1");
    expect(await failure(owner.db.execute(sql`update audit.log set actor_id = 'someone-else'`))).toMatch(/append-only/);
    expect(await failure(owner.db.execute(sql`delete from audit.log`))).toMatch(/append-only/);
  });

  it("verifies a clean chain and detects an edited row", async () => {
    await newUser("u1");
    await newCase("u1");
    await newCase("u1");
    expect(await verify()).toMatchObject({ checked: "3", first_bad_id: null });
    // Someone with the owner role switches the guard off and rewrites history.
    await owner.db.execute(sql`alter table audit.log disable trigger no_update_or_delete; update audit.log set actor_id = 'someone-else' where id = 2; alter table audit.log enable trigger no_update_or_delete`);
    expect(await verify()).toMatchObject({ checked: "1", first_bad_id: "2", head_hash: null });
  });

  it("detects a deleted row", async () => {
    await newUser("u1");
    await newCase("u1");
    await newCase("u1");
    await owner.db.execute(sql`alter table audit.log disable trigger no_update_or_delete; delete from audit.log where id = 2; alter table audit.log enable trigger no_update_or_delete`);
    expect(await verify()).toMatchObject({ first_bad_id: "3" });
  });

  it("keeps one unbroken chain under concurrent writes", async () => {
    await newUser("u1");
    await Promise.all(Array.from({ length: 20 }, () => newCase("u1")));
    expect(await verify()).toMatchObject({ checked: "21", first_bad_id: null });
  });

  it("does not deadlock when two transactions update the same rows in opposite order", async () => {
    await newUser("u1");
    const [a, b] = [await newCase("u1"), await newCase("u1")];
    const touch = (first: string, second: string) =>
      withActor(db, system, async (tx) => {
        await tx.execute(sql`update cases set origin_city = 'Irbid' where id = ${first}`);
        await new Promise((r) => setTimeout(r, 50));
        await tx.execute(sql`update cases set hospital_id = 'istanbul' where id = ${second}`);
      });
    await Promise.all([touch(a, b), touch(b, a)]);
    expect(await verify()).toMatchObject({ first_bad_id: null });
  });

  describe("sign-in writes from Better Auth (no actor)", () => {
    it("allows creating a patient account, attributed to the user", async () => {
      await db.execute(sql`insert into "user" (id, name, email) values ('u9', 'New Person', 'new@example.com')`);
      expect((await rows())[0]).toMatchObject({ actor_id: "u9", actor_type: "auth", action: "I" });
    });

    it("allows verifying an email", async () => {
      await db.execute(sql`insert into "user" (id, name, email) values ('u9', 'New Person', 'new@example.com')`);
      await db.execute(sql`update "user" set email_verified = true, updated_at = now() where id = 'u9'`);
      expect((await rows())[1]).toMatchObject({ actor_type: "auth", action: "U" });
    });

    it("refuses a role change, or creating a non-patient account", async () => {
      await db.execute(sql`insert into "user" (id, name, email) values ('u9', 'New Person', 'new@example.com')`);
      expect(await failure(db.execute(sql`update "user" set role = 'coordinator' where id = 'u9'`))).toMatch(/without an actor/);
      expect(await failure(db.execute(sql`insert into "user" (id, name, email, role) values ('u8', 'X', 'x@example.com', 'coordinator')`))).toMatch(/without an actor/);
    });

    it("allows a role change through withActor", async () => {
      await db.execute(sql`insert into "user" (id, name, email) values ('u9', 'New Person', 'new@example.com')`);
      await withActor(db, { id: "admin-1", type: "user" }, (tx) => tx.execute(sql`update "user" set role = 'coordinator' where id = 'u9'`));
      expect((await rows())[1]).toMatchObject({ actor_id: "admin-1", changed: { role: { old: "patient", new: "coordinator" } } });
    });
  });
});
