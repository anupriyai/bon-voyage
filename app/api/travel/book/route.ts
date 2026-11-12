import { actorFrom } from "@/domains/account";
import { createBookingHandlers } from "@/domains/travel/bookingHandler";
export const runtime = "nodejs";
export const maxDuration = 150;
export const { GET, POST } = createBookingHandlers(actorFrom);
