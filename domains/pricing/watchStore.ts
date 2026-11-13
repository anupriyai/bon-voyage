import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, withActor, type Actor, type Db } from "@/shared/lib/db";
import { getCaseStore, cases, searches, fareSnapshots, CaseError } from "@/domains/case/server";
import { flightContext } from "@/domains/case";
import { priceAlerts, priceWatches } from "./db";
import { combine, rank, profileFor, planningUsdRate } from "@/domains/pricing";
import type { Fare } from "@/domains/travel";
import { HttpError } from "@/shared/lib/http";
export const watchContext = (context: string) => createHmac("sha256", process.env.DATA_KEY ?? "unconfigured").update(context).digest("hex");
export function createWatchStore(db: Db) {
  return {
    async create(actor: Actor, caseId: string, searchId: string, offerId: string) {
      const own = await getCaseStore().loadCase(actor, caseId);
      return withActor(db, actor, async (tx) => {
        const [row] = await tx.select({ search: searches, fare: fareSnapshots, revision: cases.revision }).from(searches).innerJoin(cases, eq(searches.caseId, cases.id)).innerJoin(fareSnapshots, eq(fareSnapshots.searchId, searches.id)).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(searches.id, searchId), eq(fareSnapshots.offerId, offerId)));
        if (!row) throw new CaseError("not_found", 404);
        if (row.revision !== own.revision) throw new HttpError(409, "conflict");
        if (row.fare.expiresAt.getTime() <= Date.now()) throw new HttpError(410, "offer_gone");
        const slices = row.fare.slices as { from: string; to: string; segments: { departAt: string }[] }[];
        if (slices.length !== 2) throw new HttpError(400, "round_trip_required");
        const parameters = { from: slices[0].from, to: slices[0].to, out: slices[0].segments[0].departAt.slice(0, 10), back: slices[1].segments[0].departAt.slice(0, 10), passengers: row.search.parameters.passengers, context: watchContext(flightContext(own.state)) };
        const originals = await tx.select().from(fareSnapshots).where(eq(fareSnapshots.searchId, searchId));
        const fares: Fare[] = originals.map((f) => ({ id: f.offerId, provider: f.provider as Fare["provider"], slices: f.slices as Fare["slices"], totalAmount: Number(f.total), currency: f.currency, expiresAt: f.expiresAt.toISOString(), holdable: false })).filter((f) => f.slices.length === 2 && f.slices[0].from === parameters.from && f.slices[0].to === parameters.to && f.slices[0].segments[0].departAt.startsWith(parameters.out) && f.slices[1].segments[0].departAt.startsWith(parameters.back));
        const ranked = rank(combine([], [], fares), { profile: profileFor({ stage: own.state.intake.stage, wheelchair: own.state.travelSchedule?.wheelchair }), appointment: own.state.travelSchedule?.appointment ?? parameters.out, arrivalBufferDays: 2, currency: row.fare.currency, usdPerUnit: planningUsdRate(row.fare.currency) });
        const baseline = ranked.picks.cheapest?.trip.totalAmount;
        if (baseline === undefined) throw new HttpError(400, "no_suitable_watch_fare");
        const [watch] = await tx.insert(priceWatches).values({ caseId, searchId, ownerId: actor.id, offerId, provider: row.fare.provider, parameters, baseline: baseline.toFixed(2), lowest: baseline.toFixed(2), currency: row.fare.currency }).onConflictDoUpdate({ target: [priceWatches.ownerId, priceWatches.searchId, priceWatches.offerId], set: { active: true } }).returning();
        return watch;
      });
    },
    async list(actor: Actor, caseId: string) {
      const [own] = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id)));
      if (!own) throw new CaseError("not_found", 404);
      return { watches: await db.select().from(priceWatches).where(and(eq(priceWatches.caseId, caseId), eq(priceWatches.ownerId, actor.id))), alerts: await db.select({ alert: priceAlerts }).from(priceAlerts).innerJoin(priceWatches, eq(priceAlerts.watchId, priceWatches.id)).where(and(eq(priceWatches.caseId, caseId), eq(priceAlerts.ownerId, actor.id))).then((rows) => rows.map((r) => r.alert)) };
    },
    async stop(actor: Actor, id: string) { return withActor(db, actor, async (tx) => { const [row] = await tx.update(priceWatches).set({ active: false }).where(and(eq(priceWatches.id, id), eq(priceWatches.ownerId, actor.id))).returning(); if (!row) throw new CaseError("not_found", 404); return row; }); },
  };
}
export const getWatchStore = () => createWatchStore(getDb());
