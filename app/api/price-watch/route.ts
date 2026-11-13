import { actorFrom } from "@/domains/account";
import { createWatchHandlers } from "@/domains/pricing/watchHandlers";
export const runtime = "nodejs";
export const { GET, POST, DELETE } = createWatchHandlers(actorFrom);
