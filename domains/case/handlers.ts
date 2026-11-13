import { ZodError } from "zod/v4";
import type { Actor } from "@/shared/lib/db";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { CaseIdSchema, SaveCaseSchema } from "./model/persistence";
import { CaseError, getCaseStore, type CaseStore } from "./store";
import { getProfileStore } from "@/domains/account/profileStore";

type Repository = Pick<CaseStore, "loadCase" | "listCases" | "saveCase" | "deleteCase">;
export function createCaseHandlers(resolveActor: (headers: Headers) => Promise<Actor | null>, repository: () => Repository = getCaseStore) {
  async function handle(request: Request, action: (actor: Actor, store: Repository) => Promise<Response>) {
    try {
      const actor = await resolveActor(request.headers);
      if (!actor) return privateJson({ error: "unauthorized" }, 401);
      if (request.method !== "GET") requireSameOrigin(request);
      return await action(actor, repository());
    } catch (error) {
      if (error instanceof ZodError) return privateJson({ error: "invalid_request" }, 400);
      if (error instanceof CaseError || error instanceof HttpError) return privateJson({ error: error.code }, error.status);
      // Do not log raw SQL exceptions: they can include clinical values or credentials.
      return privateJson({ error: "temporarily_unavailable" }, 503);
    }
  }
  return {
    GET: (request: Request) => handle(request, async (actor, store) => {
      const id = new URL(request.url).searchParams.get("id");
      return id ? privateJson(await store.loadCase(actor, CaseIdSchema.parse(id))) : privateJson({ cases: await store.listCases(actor) });
    }),
    PUT: (request: Request) => handle(request, async (actor, store) => {
      if (process.env.NODE_ENV === "production" && !(await getProfileStore().eligibility(actor)).active) throw new HttpError(403, "real_data_unavailable");
      return privateJson(await store.saveCase(actor, SaveCaseSchema.parse(await readJson(request))));
    }),
    DELETE: (request: Request) => handle(request, async (actor, store) => {
      const params = new URL(request.url).searchParams;
      const id = CaseIdSchema.parse(params.get("id"));
      const revision = Number(params.get("revision"));
      if (!params.has("revision") || !Number.isSafeInteger(revision) || revision < 0) throw new HttpError(400, "invalid_request");
      await store.deleteCase(actor, id, revision);
      return privateJson({ deleted: true });
    }),
  };
}
