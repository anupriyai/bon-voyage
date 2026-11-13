import { z, ZodError } from "zod/v4";
import type { Actor } from "@/shared/lib/db";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { CaseError, CaseIdSchema } from "@/domains/case/server";
import type { CaseState } from "@/domains/case";
import type { Fare, FlightProvider } from "@/domains/travel";
import { findOptions, flightQuery } from "./findOptions";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FlightSearchSchema = z.object({
  caseId: CaseIdSchema, revision: z.number().int().min(1),
  schedule: z.object({ appointment: day, treatmentDays: z.number().int().min(1).max(730), recoveryDays: z.number().int().min(0).max(730), passengers: z.number().int().min(1).max(9), companionAges: z.array(z.number().int().min(0).max(120)).max(8).optional(), wheelchair: z.boolean(), flexDays: z.union([z.literal(0), z.literal(1)]).default(1), widen: z.boolean().default(false) }).strict(),
}).strict();
interface Dependencies {
  actorFrom: (headers: Headers) => Promise<Actor | null>;
  loadCase: (actor: Actor, id: string) => Promise<{ state: CaseState; revision: number }>;
  reserve: (actor: Actor, caseId: string, revision: number, parameters: Record<string, unknown>, requests: number) => Promise<string>;
  snapshots: (actor: Actor, caseId: string, searchId: string, fares: Fare[]) => Promise<void>;
  provider: () => FlightProvider;
}
export function createFlightSearchHandler(deps: Dependencies) {
  return async function POST(request: Request) {
    try {
      const actor = await deps.actorFrom(request.headers);
      if (!actor) return privateJson({ error: "unauthorized" }, 401);
      requireSameOrigin(request);
      const input = FlightSearchSchema.parse(await readJson(request, 8000));
      const owned = await deps.loadCase(actor, input.caseId);
      if (owned.revision !== input.revision) throw new HttpError(409, "conflict");
      let query: ReturnType<typeof flightQuery>;
      try { query = flightQuery(owned.state, input.schedule); }
      catch { throw new HttpError(400, "invalid_travel_details"); }
      const provider = deps.provider();
      const searchId = await deps.reserve(actor, input.caseId, input.revision, { from: query.from, to: query.to, ...query.target, passengers: query.passengers, flexDays: input.schedule.flexDays }, input.schedule.widen ? 3 : 1);
      // All provider calls run after the reservation transaction has committed.
      const options = await findOptions(owned.state, input.schedule, provider);
      const fares = [...options.ranking.valid.flatMap((v) => v.trip.fares), ...options.ranking.rejected.flatMap((r) => r.trip.fares)];
      await deps.snapshots(actor, input.caseId, searchId, fares);
      return privateJson({ ...options, searchId });
    } catch (error) {
      if (error instanceof ZodError) return privateJson({ error: "invalid_request" }, 400);
      if (error instanceof CaseError || error instanceof HttpError) return privateJson({ error: error.code }, error.status);
      return privateJson({ error: "temporarily_unavailable" }, 503);
    }
  };
}
