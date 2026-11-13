import { ZodError } from "zod/v4";
import { actorFrom, recentActorFrom } from "./auth";
import { getProfileStore, ProfileError } from "./profileStore";
import { getCaseStore } from "@/domains/case/server";
import { getCarePlanStore } from "@/domains/providers/server";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";

async function handle(request: Request, action: () => Promise<Response>) {
  try { if (request.method !== "GET") requireSameOrigin(request); return await action(); }
  catch (error) {
    if (error instanceof ZodError) return privateJson({ error: "invalid_request" }, 400);
    if (error instanceof HttpError || error instanceof ProfileError) return privateJson({ error: error.code }, error.status);
    return privateJson({ error: "temporarily_unavailable" }, 503);
  }
}
const actor = async (request: Request) => {
  const value = await actorFrom(request.headers);
  if (!value) throw new HttpError(401, "unauthorized");
  return value;
};

export const profileHandlers = {
  GET: (request: Request) => handle(request, async () => privateJson(await getProfileStore().load(await actor(request)))),
  PUT: (request: Request) => handle(request, async () => {
    const who = await actor(request); const value = await readJson(request, 4000);
    const previous = await getProfileStore().load(who);
    const nextCountry = (value as { profile?: { residenceCountry?: string } })?.profile?.residenceCountry;
    if (previous.profile && nextCountry !== previous.profile.residenceCountry) await recentActorFrom(request.headers);
    return privateJson(await getProfileStore().save(who, value));
  }),
};
export const eligibilityHandlers = {
  GET: (request: Request) => handle(request, async () => privateJson(await getProfileStore().eligibility(await actor(request)))),
};
export const consentHandlers = {
  POST: (request: Request) => handle(request, async () => {
    const who = await recentActorFrom(request.headers);
    const body = await readJson(request, 1000) as { documentVersion?: unknown };
    if (typeof body?.documentVersion !== "string" || body.documentVersion.length > 80) throw new HttpError(400, "invalid_request");
    return privateJson({ receipt: await getProfileStore().acceptHealthConsent(who, body.documentVersion) });
  }),
  DELETE: (request: Request) => handle(request, async () => { await getProfileStore().withdrawHealthConsent(await recentActorFrom(request.headers)); return privateJson({ withdrawn: true }); }),
};
export const dataRequestHandlers = {
  GET: (request: Request) => handle(request, async () => privateJson({ requests: await getProfileStore().listDataRequests(await actor(request)) })),
  POST: (request: Request) => handle(request, async () => privateJson({ request: await getProfileStore().requestData(await recentActorFrom(request.headers), await readJson(request, 1000)) })),
};
export const exportHandler = (request: Request) => handle(request, async () => {
  const who = await recentActorFrom(request.headers);
  const [profile, cases, plans, requests] = await Promise.all([
    getProfileStore().load(who), getCaseStore().listCases(who), getCarePlanStore().listPlans(who), getCarePlanStore().listRequests(who),
  ]);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), scope: "profile-and-saved-planning-data", profile, cases, plans, requests }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=bon-voyage-planning-data.json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
  });
});
