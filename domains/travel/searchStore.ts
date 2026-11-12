import { and, eq, gte, sql } from "drizzle-orm";
import { cases, searches, fareSnapshots, CaseError } from "@/domains/case/server";
import { getDb, withActor, type Actor, type Db } from "@/shared/lib/db";
import { HttpError } from "@/shared/lib/http";
import type { Fare } from "./fare";

export function createSearchStore(db: Db) {
  async function owned(tx: Parameters<Parameters<typeof withActor>[2]>[0], actor: Actor, caseId: string, revision?: number) {
    const [row] = await tx.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id))).for("update");
    if (!row) throw new CaseError("not_found", 404);
    if (revision !== undefined && row.revision !== revision) throw new CaseError("conflict", 409);
  }
  async function reserve(actor: Actor, caseId: string, revision: number, parameters: Record<string, unknown>, requests: number) {
    if (actor.type !== "user") throw new HttpError(401, "unauthorized");
    return withActor(db, actor, async (tx) => {
      await owned(tx, actor, caseId, revision);
      // The audit transaction lock makes this allowance atomic across processes and concurrent requests.
      const [usage] = await tx.select({ count: sql<number>`coalesce(sum((${searches.parameters}->>'requests')::int), 0)::int` }).from(searches)
        .where(and(eq(searches.createdBy, actor.id), gte(searches.createdAt, new Date(Date.now() - 60_000))));
      if (usage.count + requests > 6) throw new HttpError(429, "rate_limited");
      const [search] = await tx.insert(searches).values({ caseId, createdBy: actor.id, parameters: { ...parameters, requests } }).returning({ id: searches.id });
      return search.id;
    });
  }
  async function snapshots(actor: Actor, caseId: string, searchId: string, fares: Fare[]) {
    await withActor(db, actor, async (tx) => {
      await owned(tx, actor, caseId);
      const [search] = await tx.select().from(searches).where(and(eq(searches.id, searchId), eq(searches.caseId, caseId), eq(searches.createdBy, actor.id)));
      if (!search) throw new CaseError("not_found", 404);
      const unique = [...new Map(fares.map((f) => [f.id, f])).values()];
      if (unique.length) await tx.insert(fareSnapshots).values(unique.map((f) => ({
        searchId, provider: f.provider, offerId: f.id, slices: f.slices, total: f.totalAmount.toFixed(2), currency: f.currency,
        expiresAt: f.expiresAt ? new Date(f.expiresAt) : new Date(Date.now() + 15 * 60_000),
      })));
    });
  }
  return { reserve, snapshots };
}
export const getSearchStore = () => createSearchStore(getDb());
