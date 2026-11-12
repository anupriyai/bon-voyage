import { z } from "zod/v4";
import type { Actor } from "@/shared/lib/db";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";
import { CaseError } from "@/domains/case/server";
import { getStaysService } from "./stays";
export function createStaysHandlers(actorFrom: (h: Headers) => Promise<Actor | null>) {
  async function handle(request: Request, run: (actor: Actor) => Promise<unknown>) {
    try { const actor = await actorFrom(request.headers); if (!actor) throw new HttpError(401, "unauthorized"); if (request.method !== "GET") requireSameOrigin(request); return privateJson(await run(actor)); }
    catch (e) { if (e instanceof HttpError || e instanceof CaseError) return privateJson({ error: e.code }, e.status); if (e instanceof z.ZodError) return privateJson({ error: "invalid_request" }, 400); return privateJson({ error: "stays_unavailable" }, 503); }
  }
  return {
    GET: (request: Request) => handle(request, async (actor) => ({ bookings: await getStaysService().list(actor, z.uuid().parse(new URL(request.url).searchParams.get("caseId"))) })),
    POST: (request: Request) => handle(request, async (actor) => {
      const body = z.record(z.string(), z.unknown()).parse(await readJson(request, 16000));
      const { action, ...input } = body; const service = getStaysService();
      if (action === "search") return service.search(actor, input);
      if (action === "quote") { const value = z.object({ caseId: z.uuid(), searchId: z.uuid(), resultId: z.string().max(1500) }).strict().parse(input); return service.quote(actor, value.caseId, value.searchId, value.resultId); }
      if (action === "book") return service.book(actor, input);
      if (action === "reconcile") return service.reconcile(actor, z.object({ bookingId: z.uuid() }).strict().parse(input).bookingId);
      throw new HttpError(400, "invalid_action");
    }),
  };
}
