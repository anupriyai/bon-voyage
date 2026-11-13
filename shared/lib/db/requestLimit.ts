import { sql } from "drizzle-orm";
import { withActor, type Db } from "./client";
/** Sliding-window counter for Better Auth's atomic customStorage interface. Keys are HMACs, never IPs. */
export async function consumeRequestLimit(db: Db, keyHash: string, rule: { window: number; max: number }) {
  const now = Date.now(); const reset = new Date(now + rule.window * 1000);
  return withActor(db, { type: "system", id: "auth-rate-limit" }, async (tx) => {
    await tx.execute(sql`insert into rate_limit (key_hash, "limit", remaining, reset_at) values (${keyHash}, ${rule.max}, ${rule.max}, ${reset}) on conflict do nothing`);
    const result = await tx.execute(sql`select remaining, reset_at from rate_limit where key_hash = ${keyHash} for update`);
    const row = result.rows[0] as { remaining: number; reset_at: string | Date };
    const remaining = new Date(row.reset_at).getTime() <= now ? rule.max : row.remaining;
    if (remaining <= 0) return { allowed: false, retryAfter: Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - now) / 1000)) };
    await tx.execute(sql`update rate_limit set remaining = ${remaining - 1}, reset_at = ${reset}, updated_at = ${new Date(now)} where key_hash = ${keyHash}`);
    return { allowed: true, retryAfter: null };
  });
}
