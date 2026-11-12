import { actorFrom } from "@/domains/account";
import { createStaysHandlers } from "@/domains/travel/staysHandler";
export const runtime = "nodejs";
export const maxDuration = 150;
export const { GET, POST } = createStaysHandlers(actorFrom);
