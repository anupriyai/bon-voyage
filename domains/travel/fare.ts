// Our own flight shapes. Providers (Duffel, mock) translate into these; nothing else sees provider types.
// Times are ISO 8601 with the airport's local offset, e.g. "2026-11-02T08:15:00+03:00", so the local date and hour
// read straight off the string and Date.parse still gives true durations.

export interface Segment {
  from: string; // IATA
  to: string;
  departAt: string;
  arriveAt: string;
  carrier: string;
  flightNumber: string;
}

/** One direction of a trip: one or more segments. */
export interface Slice {
  from: string;
  to: string;
  segments: Segment[];
}

export interface Fare {
  id: string;
  provider: "duffel" | "mock";
  /** One slice for a one-way fare, two for a return. */
  slices: Slice[];
  /** For all passengers, in major units (e.g. 412.5). */
  totalAmount: number;
  currency: string;
  expiresAt: string | null;
  /** The airline lets us hold the seat and pay later. */
  holdable: boolean;
}
