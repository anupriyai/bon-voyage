import { z, ZodError } from "zod/v4";
import type { Actor } from "@/shared/lib/db";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { CareRequestSchema, SaveCarePlanSchema } from "./plan";
import { CarePlanError, getCarePlanStore, type CarePlanStore } from "./store";
import { findPublicOffer } from "./catalogue";

export function createCarePlanHandlers(resolveActor: (headers: Headers) => Promise<Actor | null>, repository: () => CarePlanStore = getCarePlanStore) {
  async function handle(request: Request, action: (actor: Actor, store: CarePlanStore) => Promise<Response>) {
    try {
      const actor = await resolveActor(request.headers);
      if (!actor || actor.type !== "user") return privateJson({ error: "unauthorized" }, 401);
      if (request.method !== "GET") requireSameOrigin(request);
      return await action(actor, repository());
    } catch (error) {
      if (error instanceof ZodError) return privateJson({ error: "invalid_request" }, 400);
      if (error instanceof CarePlanError || error instanceof HttpError) return privateJson({ error: error.code }, error.status);
      // Never expose SQL details, selections or credentials in logs or error responses.
      return privateJson({ error: "temporarily_unavailable" }, 503);
    }
  }
  return {
    GET: (request: Request) => handle(request, async (actor, store) => {
      const id = new URL(request.url).searchParams.get("id");
      return id ? privateJson({ plan: await store.loadPlan(actor, z.uuid().parse(id)) }) : privateJson({ plans: await store.listPlans(actor) });
    }),
    PUT: (request: Request) => handle(request, async (actor, store) => {
      const input = SaveCarePlanSchema.parse(await readJson(request, 12000));
      if (!findPublicOffer(input.draft.offerId)) throw new CarePlanError("not_found", 404);
      return privateJson({ plan: await store.savePlan(actor, input) });
    }),
    GET_REQUESTS: (request: Request) => handle(request, async (actor, store) => privateJson({ requests: await store.listRequests(actor) })),
    POST_REQUEST: (request: Request) => handle(request, async (actor, store) => {
      const input = CareRequestSchema.parse(await readJson(request, 4000));
      const plan = await store.loadPlan(actor, input.planId);
      if (!findPublicOffer(plan.draft.offerId)) throw new CarePlanError("not_found", 404);
      return privateJson({ request: await store.requestCare(actor, input) });
    }),
  };
}
