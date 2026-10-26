// Test helpers: compact builders for fares. Only imported by *.test.ts files.
import type { Fare, Segment, Slice } from "@/domains/travel/index";

/**
 * One segment departing at `departAt` (local, with offset) and flying `hours`.
 * `arriveOffset` is the arrival airport's offset; defaults to the departure offset.
 */
export function seg(from: string, to: string, departAt: string, hours: number, { carrier = "XX", arriveOffset }: { carrier?: string; arriveOffset?: string } = {}): Segment {
  const offset = arriveOffset ?? (departAt.slice(19) || "+00:00");
  const arrive = new Date(Date.parse(departAt) + hours * 3_600_000);
  return { from, to, departAt, arriveAt: toOffset(arrive, offset), carrier, flightNumber: `${carrier}1` };
}

export function slice(...segments: Segment[]): Slice {
  return { from: segments[0].from, to: segments[segments.length - 1].to, segments };
}

export function fare(id: string, totalAmount: number, ...slices: Slice[]): Fare {
  return { id, provider: "mock", slices, totalAmount, currency: "USD", expiresAt: null, holdable: false };
}

function toOffset(d: Date, offset: string): string {
  const sign = offset[0] === "-" ? -1 : 1;
  const mins = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
  return new Date(d.getTime() + mins * 60_000).toISOString().slice(0, 19) + offset;
}
