import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { getDb, withActor, type Db } from "@/shared/lib/db";
import { claimJob } from "@/shared/lib/db/jobLease";
import { getCaseStore } from "@/domains/case/server";
import { flightContext } from "@/domains/case";
import { getFlightProvider } from "@/domains/travel/server";
import type { FlightProvider } from "@/domains/travel";
import { priceWatches, priceAlerts } from "./db";
import { watchContext } from "./watchStore";
import { checkWatch } from "./model/priceWatch";
import { rank, profileFor } from "./model/ranking";
import { planningUsdRate } from "./model/exchange";
import { searchTrips } from "./search";
const querySchema = z.object({ from: z.string().length(3), to: z.string().length(3), out: z.string(), back: z.string(), passengers: z.array(z.object({ type: z.enum(["adult", "child", "infant_without_seat"]), age: z.number().optional() })).min(1).max(9), context: z.string() });
export async function runWatchJob({ db = getDb(), provider = getFlightProvider("background"), slot = String(Math.floor(Date.now() / (6 * 3600000))), budgetMs = 240000 }: { db?: Db; provider?: FlightProvider; slot?: string; budgetMs?: number } = {}) {
  const lease = await claimJob(db, "price-watch", slot);
  if (!lease) return { skipped: true, processed: 0, alerts: 0 };
  const actor = { type: "system" as const, id: "price-watch" }; const deadline = Date.now() + budgetMs;
  let processed = 0; let alerts = 0; let completed = false;
  try {
    const watches = await db.select().from(priceWatches).where(and(eq(priceWatches.active, true), sql`${priceWatches.lastSlot} is distinct from ${slot}`)).orderBy(sql`${priceWatches.lastCheckedAt} nulls first`, asc(priceWatches.createdAt)).limit(20);
    for (const watch of watches) {
      if (Date.now() >= deadline) break;
      try {
        if (watch.provider !== provider.name) continue;
        const query = querySchema.parse(watch.parameters);
        const own = await getCaseStore().loadCase({ type: "user", id: watch.ownerId }, watch.caseId);
        if (query.context !== watchContext(flightContext(own.state)) || query.out < new Date().toISOString().slice(0, 10)) {
          await withActor(db, actor, (tx) => tx.update(priceWatches).set({ active: false }).where(eq(priceWatches.id, watch.id))); continue;
        }
        const trips = await searchTrips(provider, { query, passengers: query.passengers });
        const ranking = rank(trips, { profile: profileFor({ stage: own.state.intake.stage, wheelchair: own.state.travelSchedule?.wheelchair }), appointment: own.state.travelSchedule?.appointment ?? query.out, arrivalBufferDays: 2, currency: watch.currency, usdPerUnit: planningUsdRate(watch.currency) });
        const price = ranking.picks.cheapest?.trip.totalAmount ?? null;
        await withActor(db, actor, async (tx) => {
          const [current] = await tx.select().from(priceWatches).where(eq(priceWatches.id, watch.id)).for("update");
          if (!current?.active || current.lastSlot === slot) return;
          const state = checkWatch({ baseline: current.baseline === null ? null : Number(current.baseline), lowest: current.lowest === null ? null : Number(current.lowest) }, price, { pct: current.thresholdPct, amount: Number(current.thresholdAmount) });
          await tx.update(priceWatches).set({ baseline: state.baseline?.toFixed(2) ?? null, lowest: state.lowest?.toFixed(2) ?? null, lastCheckedAt: new Date(), lastSlot: slot }).where(eq(priceWatches.id, watch.id));
          if (state.alert) { await tx.insert(priceAlerts).values({ watchId: watch.id, ownerId: watch.ownerId, from: state.alert.from.toFixed(2), to: state.alert.to.toFixed(2), currency: watch.currency, slot }).onConflictDoNothing(); alerts++; }
          processed++;
        });
      } catch (error) { if ((error as { status?: number }).status === 429) break; /* Isolate failures, without logging health data or provider messages. */ }
    }
    completed = true;
    return { skipped: false, processed, alerts };
  } finally { await lease.release(completed); }
}
