export type { Fare, Segment, Slice } from "@/domains/travel/fare";
export type { FlightProvider, OneWaySearch, Passenger, ReturnSearch } from "@/domains/travel/flightProvider";
export { createMockProvider } from "@/domains/travel/mockProvider";
export { alternatesFor, type Alternate } from "@/domains/travel/alternates";

export { airportsFor, HOSPITAL_AIRPORTS } from "./airports";
export { BookingPanel } from "./components/BookingPanel";
export { SAMPLE_AIRPORTS } from "./mockProvider";
export type { PublicStayOption } from "./publicSearch";
