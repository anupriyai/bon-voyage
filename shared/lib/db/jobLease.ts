import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { withActor, type Db } from "./client";
export async function claimJob(db: Db, name: string, slot: string, milliseconds = 270000) {
  const owner = randomUUID(); const actor = { type: "system" as const, id: name };
  const acquired = await withActor(db, actor, async (tx) => {
    await tx.execute(sql`insert into job_lock (name) values (${name}) on conflict do nothing`);
    const result = await tx.execute(sql`select lease_until, last_slot from job_lock where name = ${name} for update`);
    const row = result.rows[0] as { lease_until: Date | string | null; last_slot: string | null };
    if ((row.lease_until && new Date(row.lease_until).getTime() > Date.now()) || row.last_slot === slot) return false;
    await tx.execute(sql`update job_lock set lease_owner = ${owner}, lease_until = ${new Date(Date.now() + milliseconds)} where name = ${name}`);
    return true;
  });
  if (!acquired) return null;
  return { async release(completed: boolean) { await withActor(db, actor, (tx) => tx.execute(sql`update job_lock set lease_owner = null, lease_until = null, last_slot = case when ${completed} then ${slot} else last_slot end where name = ${name} and lease_owner = ${owner}`)); } };
}
