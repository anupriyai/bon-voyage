// Hand-picked alternate airports, at most two per main airport. A curated list, not a radius search:
// a radius picks airports patients can't or shouldn't use (Tel Aviv for Amman, Damascus for Beirut).
// Product decision; extend per served city. `extraKm` is the rough extra ground distance versus the main airport.

export interface Alternate {
  iata: string;
  extraKm: number;
}

const ALTERNATES: Record<string, Alternate[]> = {
  IST: [{ iata: "SAW", extraKm: 45 }],
  SAW: [{ iata: "IST", extraKm: 45 }],
  DXB: [
    { iata: "SHJ", extraKm: 20 },
    { iata: "DWC", extraKm: 45 },
  ],
  CAI: [{ iata: "SPX", extraKm: 40 }],
};

export function alternatesFor(iata: string): Alternate[] {
  return ALTERNATES[iata] ?? [];
}
