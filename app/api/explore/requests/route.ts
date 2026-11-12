import { actorFrom } from "@/domains/account";
import { createCarePlanHandlers } from "@/domains/providers/server";

const handlers = createCarePlanHandlers(actorFrom);
export const GET = handlers.GET_REQUESTS;
export const POST = handlers.POST_REQUEST;
