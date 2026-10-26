import type { Fare } from "@/domains/travel/fare";

export interface Passenger {
  type: "adult" | "child";
  /** Required by airlines for children. */
  age?: number;
}

export interface OneWaySearch {
  from: string;
  to: string;
  date: string; // YYYY-MM-DD, local
  passengers: Passenger[];
  maxConnections?: 0 | 1 | 2;
}

export interface ReturnSearch {
  from: string;
  to: string;
  out: string;
  back: string;
  passengers: Passenger[];
  maxConnections?: 0 | 1 | 2;
}

/** A source of bookable fares. Duffel in real use, the mock when no token is set. */
export interface FlightProvider {
  readonly name: Fare["provider"];
  searchOneWay(q: OneWaySearch): Promise<Fare[]>;
  searchReturn(q: ReturnSearch): Promise<Fare[]>;
  /** The offer's current price, or null when it is gone. */
  reprice(fareId: string): Promise<Fare | null>;
}
