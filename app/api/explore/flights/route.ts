import { createPublicTravelHandler } from "@/domains/travel/server";
export const runtime = "nodejs";
export const POST = createPublicTravelHandler("flights");
