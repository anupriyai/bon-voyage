import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, withActor, type Db } from "@/shared/lib/db";
import { HttpError } from "@/shared/lib/http";
import { rateLimit } from "./db";
export function allowance(remaining: number, kind: "interactive" | "background", reserve = 4) { return remaining > (kind === "background" ? reserve : 0); }
export function parseRateHeaders(headers: { get(name: string): string | null }) {
  const limit = Number(headers.get("ratelimit-limit")); const remaining = Number(headers.get("ratelimit-remaining")); const reset = Date.parse(headers.get("ratelimit-reset") ?? "");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000 || !Number.isInteger(remaining) || remaining < 0 || !Number.isFinite(reset)) return null;
  return { limit, remaining: Math.min(limit, remaining), resetAt: new Date(reset) };
}
export function createRateLimiter(db: Db, token: string, kind: "interactive" | "background", now = Date.now) {
  const key = createHash("sha256").update(token).digest("hex");
  const system = { type: "system" as const, id: "provider-rate-limit" };
  return {
    async consume() {
      await withActor(db, system, async (tx) => {
        const time = now(); const limit = 10;
        await tx.insert(rateLimit).values({ keyHash: key, limit, remaining: limit, resetAt: new Date(time + 60000) }).onConflictDoNothing();
        const [row] = await tx.select().from(rateLimit).where(eq(rateLimit.keyHash, key)).for("update");
        const expired = row.resetAt.getTime() <= time;
        const remaining = expired ? row.limit : row.remaining;
        if (!allowance(remaining, kind)) throw new HttpError(429, "rate_limited");
        await tx.update(rateLimit).set({ remaining: remaining - 1, resetAt: expired ? new Date(time + 60000) : row.resetAt, updatedAt: new Date(time) }).where(eq(rateLimit.keyHash, key));
      });
    },
    async observe(headers: { get(name: string): string | null }) {
      const observed = parseRateHeaders(headers); if (!observed) return;
      await withActor(db, system, async (tx) => {
        const [row] = await tx.select().from(rateLimit).where(eq(rateLimit.keyHash, key)).for("update");
        if (!row) return;
        // Responses can arrive out of order. Never restore spent quota inside the current window.
        await tx.update(rateLimit).set({ limit: observed.limit, remaining: Math.min(row.remaining, observed.remaining), resetAt: new Date(Math.max(row.resetAt.getTime(), observed.resetAt.getTime())), updatedAt: new Date(now()) }).where(eq(rateLimit.keyHash, key));
      });
    },
  };
}
export const getRateLimiter = (token: string, kind: "interactive" | "background") => createRateLimiter(getDb(), token, kind);
