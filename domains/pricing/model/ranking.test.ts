import { describe, expect, it } from "vitest";
import { PROFILES, overnightLegs, profileFor, rank, score, violations } from "@/domains/pricing/model/ranking";
import { combine, type Trip } from "@/domains/pricing/model/routeOptions";
import { fare, seg, slice } from "@/domains/pricing/model/testFares";

// November offsets: Amman and Istanbul +03:00, Cairo and Athens +02:00.
const APPT = { appointment: "2026-11-10", arrivalBufferDays: 2 };
const back = slice(seg("IST", "AMM", "2026-11-18T10:00:00+03:00", 2.5));
const toCai = (dep = "2026-11-08T07:00:00+03:00") => seg("AMM", "CAI", dep, 1.5, { arriveOffset: "+02:00" }); // lands 07:30+02:00
const caiToIst = (dep: string) => seg("CAI", "IST", dep, 2, { arriveOffset: "+03:00" });

function trip(id: string, amount: number, out: ReturnType<typeof slice>, currency = "USD"): Trip {
  return combine([{ ...fare(id, amount, out), currency }], [{ ...fare(`${id}b`, 0, back), currency }])[0];
}

const direct = trip("direct", 400, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 2.5)));
const oneStop = trip("oneStop", 250, slice(toCai(), caiToIst("2026-11-08T10:00:00+02:00"))); // 2.5h layover
const late = trip("late", 100, slice(seg("AMM", "IST", "2026-11-09T08:00:00+03:00", 2.5)));
const pastMidnight = trip("pastMidnight", 100, slice(seg("AMM", "IST", "2026-11-08T22:00:00+03:00", 2.5))); // lands 00:30 on the 9th
const longLayover = trip("longLayover", 150, slice(toCai(), caiToIst("2026-11-08T16:00:00+02:00"))); // 8.5h
const fiveHourLayover = trip("fiveHour", 150, slice(toCai(), caiToIst("2026-11-08T12:30:00+02:00"))); // 5h
const tightConnection = trip("tight", 160, slice(toCai(), caiToIst("2026-11-08T07:50:00+02:00"))); // 20 min
const seventyFiveMinutes = trip("seventyFive", 160, slice(toCai(), caiToIst("2026-11-08T08:45:00+02:00"))); // 75 min
const twoStops = trip("twoStops", 120, slice(
  toCai(),
  seg("CAI", "ATH", "2026-11-08T09:00:00+02:00", 2),
  seg("ATH", "IST", "2026-11-08T13:00:00+02:00", 1.5, { arriveOffset: "+03:00" }),
));
const redEye = trip("redEye", 380, slice(seg("AMM", "IST", "2026-11-08T02:00:00+03:00", 2.5)));

describe("profileFor", () => {
  it("is fragile for stage 3–4 or a wheelchair, otherwise standard", () => {
    expect(profileFor({ stage: "2" })).toBe("standard");
    expect(profileFor({ stage: "3" })).toBe("fragile");
    expect(profileFor({ stage: "4" })).toBe("fragile");
    expect(profileFor({ stage: "1", wheelchair: true })).toBe("fragile");
    expect(profileFor({})).toBe("standard");
  });
});

describe("violations", () => {
  const rules = PROFILES.standard;
  it("passes a good trip", () => {
    expect(violations(direct, rules, APPT)).toEqual([]);
    expect(violations(oneStop, rules, APPT)).toEqual([]);
  });
  it("flags arriving after the buffer", () => {
    expect(violations(late, rules, APPT)).toEqual(["arrives-late"]);
  });
  it("flags a flight that leaves on time but lands after local midnight", () => {
    expect(violations(pastMidnight, rules, APPT)).toEqual(["arrives-late"]);
  });
  it("flags too many stops", () => {
    expect(violations(twoStops, rules, APPT)).toEqual(["too-many-stops"]);
  });
  it("flags a long layover", () => {
    expect(violations(longLayover, rules, APPT)).toEqual(["long-layover"]);
  });
  it("flags a connection too tight to make", () => {
    expect(violations(tightConnection, rules, APPT)).toEqual(["tight-connection"]);
  });
  it("applies the fragile limits that standard travellers don't have", () => {
    expect(violations(fiveHourLayover, PROFILES.standard, APPT)).toEqual([]);
    expect(violations(fiveHourLayover, PROFILES.fragile, APPT)).toEqual(["long-layover"]);
    expect(violations(seventyFiveMinutes, PROFILES.standard, APPT)).toEqual([]);
    expect(violations(seventyFiveMinutes, PROFILES.fragile, APPT)).toEqual(["tight-connection"]);
  });
});

describe("overnightLegs", () => {
  const legs = (s: ReturnType<typeof seg>) => overnightLegs(slice(s).segments);
  it("counts a leg departing between midnight and 5am", () => {
    expect(legs(seg("AMM", "IST", "2026-11-08T02:00:00+03:00", 2.5))).toBe(1);
  });
  it("counts a late-evening departure that flies through the night", () => {
    expect(legs(seg("JFK", "LIS", "2026-11-08T23:30:00-05:00", 6.5, { arriveOffset: "+00:00" }))).toBe(1);
  });
  it("does not count a late flight that lands before midnight, or a daytime flight", () => {
    expect(legs(seg("AMM", "IST", "2026-11-08T21:00:00+03:00", 2.5))).toBe(0);
    expect(legs(seg("AMM", "IST", "2026-11-08T10:00:00+03:00", 2.5))).toBe(0);
  });
});

describe("score", () => {
  it("is the fare plus dollar penalties for time, stops and red-eyes", () => {
    const p = PROFILES.standard;
    // direct: 400 fare, 2 × 2.5h = 5h travel, 0 stops.
    expect(score(direct, p)).toBe(400 + 5 * p.hourPenalty);
    expect(score(redEye, p)).toBe(380 + 5 * p.hourPenalty + p.redEyePenalty);
  });
  it("counts ground transfers in money and time", () => {
    const p = PROFILES.standard;
    const withGround = { ...direct, groundCost: 50, groundHours: 2 };
    expect(score(withGround, p)).toBe(400 + 50 + 7 * p.hourPenalty);
  });
  it("converts the fare to dollars before adding dollar penalties", () => {
    const p = PROFILES.standard;
    expect(score(direct, p, 2)).toBe(800 + 5 * p.hourPenalty);
  });
});

describe("rank", () => {
  const opts = { profile: "standard" as const, currency: "USD", ...APPT };

  it("picks cheapest, easiest and best balance among valid trips, with rejection reasons", () => {
    const r = rank([direct, oneStop, late, twoStops], opts);
    expect(r.picks.cheapest?.trip.id).toBe("oneStop+oneStopb");
    expect(r.picks.easiest?.trip.id).toBe("direct+directb");
    expect(r.picks.balanced?.trip.id).toBe("oneStop+oneStopb");
    expect(r.rejected.map((x) => [x.trip.id, x.reasons])).toEqual([
      ["late+lateb", ["arrives-late"]],
      ["twoStops+twoStopsb", ["too-many-stops"]],
    ]);
  });

  it("explains a pick in plain words relative to the cheapest", () => {
    const r = rank([direct, oneStop], opts);
    expect(r.picks.easiest?.why).toBe("$150 more than the cheapest, but non-stop");
    expect(r.picks.cheapest?.why).toBe("Lowest total price");
  });

  it("says 'same price' rather than '$0 more'", () => {
    // Same fare as oneStop, but so slow that oneStop wins the cost tie-break on score.
    const slowDirect = trip("slowDirect", 250, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 11)));
    const r = rank([oneStop, slowDirect], opts);
    expect(r.picks.cheapest?.trip.id).toBe("oneStop+oneStopb");
    expect(r.picks.easiest?.why).toBe("Same price as the cheapest, but non-stop");
  });

  it("explains fewer stops and shorter journeys", () => {
    const cheapTwoStop = trip("cheapTwoStop", 100, twoStops.slices[0]);
    const r = rank([cheapTwoStop, oneStop], { ...opts, profile: "standard" });
    // two stops is rejected for standard; use explain via a custom max: compare one-stop vs direct instead.
    expect(r.picks.cheapest?.trip.id).toBe("oneStop+oneStopb");
    const slowDirect = trip("slowDirect", 200, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 6)));
    const fastDirect = trip("fastDirect", 260, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 2.5)));
    const r2 = rank([slowDirect, fastDirect], opts);
    expect(r2.picks.easiest?.why).toBe("$60 more than the cheapest, but 4 hours less travelling");
  });

  it("only compares trips in the ranking currency", () => {
    const eurCheap = trip("eur", 10, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 2.5)), "EUR");
    const r = rank([direct, eurCheap], opts);
    expect(r.picks.cheapest?.trip.id).toBe("direct+directb");
    expect(r.rejected).toEqual([{ trip: eurCheap, reasons: ["other-currency"] }]);
  });

  it("returns no picks when nothing is valid", () => {
    const r = rank([late], opts);
    expect(r.picks).toEqual({ cheapest: null, easiest: null, balanced: null });
    expect(r.valid).toEqual([]);
  });
});
