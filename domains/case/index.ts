// Browser-safe public surface. Server handlers and database code stay out of this entry point.
export * from "./data/catalogue";
export * from "./model/engine";
export * from "./model/assistant";
export * from "./state/store";
export { FlowBackdrop } from "./components/CaseShell";
export { PHASES as CASE_PHASES } from "./components/JourneyBar";
export { SimpleBar } from "./components/SimpleBar";

export { safeReturnPath } from "./model/persistence";
export { flightContext, selectedFlightFor, type TravelSchedule, type FlightSelection } from "./model/caseState";
export { selectedStayFor, type StaySelection } from "./model/caseState";
export { updatedFlightPrice } from "./model/caseState";
