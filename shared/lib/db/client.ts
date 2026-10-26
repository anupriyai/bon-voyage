// The database connection, and the only way the app writes: inside withActor, so every change to an audited
// table is attributed (see migrations/0001_audit.sql).
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface Actor {
  /** User id, or a job name for system actors. */
  id: string;
  type: "user" | "system";
  requestId?: string;
}

/** Must match the lock key in audit.capture(). */
const AUDIT_LOCK = 4242001;

export function createDb(url: string, max = 5): { db: Db; pool: Pool } {
  // Small pool: in production it sits on top of Neon's PgBouncer.
  const pool = new Pool({ connectionString: url, max });
  return { db: drizzle({ client: pool }), pool };
}

// One pool per server process; dev hot reload re-runs modules, so keep it on globalThis.
const cache = globalThis as unknown as { bonVoyageDb?: Db };

export function getDb(): Db {
  if (!cache.bonVoyageDb) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    cache.bonVoyageDb = createDb(process.env.DATABASE_URL).db;
  }
  return cache.bonVoyageDb;
}

/**
 * Runs `fn` in a transaction attributed to `actor`. Takes the audit chain lock first, before any row locks,
 * so audited writes can't deadlock on it. Keep network calls (flights, AI, email) outside `fn`: the lock is
 * held until commit.
 */
export async function withActor<T>(db: Db, actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!actor.id) throw new Error("withActor needs an actor id");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select
      pg_advisory_xact_lock(${AUDIT_LOCK}::bigint),
      set_config('app.actor_id', ${actor.id}, true),
      set_config('app.actor_type', ${actor.type}, true),
      set_config('app.request_id', ${actor.requestId ?? randomUUID()}, true)`);
    return fn(tx);
  });
}
