// Public server API; never re-export from the browser index.
import { getRateLimiter } from "@/domains/pricing/server";
import { createHash } from "node:crypto";
import { createMockProvider } from "./mockProvider";
import { createDuffelProvider } from "./duffelProvider";
import { cacheProvider } from "./providerCache";
import { ProviderError } from "./providerError";
import type { FlightProvider } from "./flightProvider";
export { createSearchStore, getSearchStore } from "./searchStore";
const mockFactor = Number(process.env.MOCK_FLIGHT_PRICE_FACTOR ?? 1);
const mock = createMockProvider({ priceFactor: Number.isFinite(mockFactor) && mockFactor > 0 ? mockFactor : 1 });
const cached = new Map<string, FlightProvider>();
export function getFlightProvider(kind: "interactive" | "background" = "interactive"): FlightProvider {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) return mock;
  if (token.startsWith("duffel_live_") && process.env.DUFFEL_LIVE_ENABLED !== "true") throw new ProviderError("live_mode_disabled", 403);
  const key = createHash("sha256").update(token).digest("hex") + kind;
  if (!cached.has(key)) cached.set(key, cacheProvider(createDuffelProvider({ token, limiter: getRateLimiter(token, kind) })));
  return cached.get(key)!;
}

export { getBookingStore, createBookingStore } from "./bookingStore";
export { createOrderProvider } from "./orderProvider";
export { quoteFlight, bookFlight, reconcileBooking, payHold } from "./booking";
export { createPublicTravelHandler, publicSampleFlights, publicSampleStays, verifyCareTravelSelection } from "./publicSearch";
