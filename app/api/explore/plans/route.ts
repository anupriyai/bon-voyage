import { actorFrom } from "@/domains/account";
import { createCarePlanHandlers } from "@/domains/providers/server";

// Web Request/Response handlers: installed Next docs, getting-started/15-route-handlers.md.
const handlers = createCarePlanHandlers(actorFrom);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
