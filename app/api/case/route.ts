import { actorFrom } from "@/domains/account";
import { createCaseHandlers } from "@/domains/case/handlers";

export const runtime = "nodejs";
export const { GET, PUT, DELETE } = createCaseHandlers(actorFrom);
