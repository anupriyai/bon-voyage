// Which travel dates to search around a hospital appointment. Dates are calendar days ("YYYY-MM-DD").

export interface WindowInput {
  appointment: string;
  /** Land at least this many days before the appointment. */
  arrivalBufferDays?: number;
  treatmentDays: number;
  recoveryDays: number;
  /** How many extra days either side of the ideal date to try. */
  flexDays?: number;
  /** Extra earlier departure days for journeys that land a day (or more) after they leave. */
  maxTransitDays?: number;
}

export interface DateWindow {
  /** Departure dates. Ranking then checks each trip really lands by the buffer. */
  outbound: string[];
  return: string[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(day: string, n: number): string {
  const base = DAY.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN;
  // Date.parse rolls "2026-02-30" over to March; require the day to round-trip.
  if (Number.isNaN(base) || new Date(base).toISOString().slice(0, 10) !== day) throw new Error(`Not a calendar day: "${day}"`);
  return new Date(base + n * 86_400_000).toISOString().slice(0, 10);
}

function range(first: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/**
 * Outbound: departure days from `flexDays + maxTransitDays` before the latest landing day up to that day,
 * so overnight and long-haul flights that land the next day are searched too.
 * Return: the first day after treatment and recovery, and up to `flexDays` later, never earlier.
 */
export function dateWindow({ appointment, arrivalBufferDays = 2, treatmentDays, recoveryDays, flexDays = 2, maxTransitDays = 1 }: WindowInput): DateWindow {
  const latestLanding = addDays(appointment, -arrivalBufferDays);
  const earliestBack = addDays(appointment, treatmentDays + recoveryDays);
  const earlier = flexDays + maxTransitDays;
  return {
    outbound: range(addDays(latestLanding, -earlier), earlier + 1),
    return: range(earliestBack, flexDays + 1),
  };
}
