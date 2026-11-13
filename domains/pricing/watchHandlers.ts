import { z } from "zod/v4";
import type { Actor } from "@/shared/lib/db";
import { CaseError } from "@/domains/case/server";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { authorizedJob } from "@/shared/lib/jobAuth";
import { getWatchStore } from "./watchStore";
import { sendDailyDigests } from "./emailDigest";
import { runWatchJob } from "./watchJob";
export function createWatchHandlers(actorFrom: (h: Headers) => Promise<Actor | null>) {
  async function handle(request: Request, work: (actor: Actor) => Promise<unknown>) {
    try { const actor = await actorFrom(request.headers); if (!actor) throw new HttpError(401, "unauthorized"); if (request.method !== "GET") requireSameOrigin(request); return privateJson(await work(actor)); }
    catch (e) { if (e instanceof HttpError || e instanceof CaseError) return privateJson({ error: e.code }, e.status); if (e instanceof z.ZodError) return privateJson({ error: "invalid_request" }, 400); return privateJson({ error: "temporarily_unavailable" }, 503); }
  }
  return {
    GET: (request: Request) => handle(request, (actor) => getWatchStore().list(actor, z.uuid().parse(new URL(request.url).searchParams.get("caseId")))),
    POST: (request: Request) => handle(request, async (actor) => { const input = z.object({ caseId: z.uuid(), searchId: z.uuid(), offerId: z.string().max(250) }).strict().parse(await readJson(request, 2000)); return getWatchStore().create(actor, input.caseId, input.searchId, input.offerId); }),
    DELETE: (request: Request) => handle(request, (actor) => getWatchStore().stop(actor, z.uuid().parse(new URL(request.url).searchParams.get("id")))),
  };
}
export async function watchRunHandler(request: Request) {
  if (!authorizedJob(request)) return privateJson({ error: "unauthorized" }, 401);
  try { return privateJson({ ...await runWatchJob(), digest: await sendDailyDigests() }); } catch { return privateJson({ error: "temporarily_unavailable" }, 503); }
}
