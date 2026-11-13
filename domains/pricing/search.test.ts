import { describe, expect, it, vi } from "vitest";
import { createMockProvider, type FlightProvider } from "@/domains/travel/index";
import { dateWindow } from "@/domains/pricing/model/dateWindow";
import { rank } from "@/domains/pricing/model/ranking";
import { searchTrips, splitFallback, targetDates, widenTrips } from "@/domains/pricing/search";

const passengers = [{ type: "adult" as const }];
const window = dateWindow({ appointment: "2026-11-10", treatmentDays: 5, recoveryDays: 3 });
const rankOpts = { profile: "standard" as const, appointment: "2026-11-10", arrivalBufferDays: 2, currency: "USD" };

describe("targetDates", () => {
  it("is the latest departure in the window and the first day after recovery", () => {
    expect(targetDates(window)).toEqual({ out: "2026-11-08", back: "2026-11-18" });
  });
});

describe("searchTrips", () => {
  it("makes exactly one round-trip request", async () => {
    const mock = createMockProvider();
    const ret = vi.spyOn(mock, "searchReturn");
    const oneWay = vi.spyOn(mock, "searchOneWay");
    const trips = await searchTrips(mock, { query: { from: "AMM", to: "IST", ...targetDates(window) }, passengers });
    expect(ret).toHaveBeenCalledTimes(1);
    expect(oneWay).not.toHaveBeenCalled();
    expect(trips.length).toBeGreaterThan(0);
    expect(trips.every((t) => t.kind === "return")).toBe(true);
  });
});

describe("widenTrips", () => {
  const plan = [
    { from: "AMM", to: "IST", out: "2026-11-07", back: "2026-11-18" },
    { from: "AMM", to: "IST", out: "2026-11-08", back: "2026-11-19" },
    { from: "AMM", to: "SAW", out: "2026-11-08", back: "2026-11-18" },
  ];

  it("runs each planned round trip once, and reports how many requests it spent", async () => {
    const mock = createMockProvider();
    const ret = vi.spyOn(mock, "searchReturn");
    const { trips, requests, failures } = await widenTrips(mock, { queries: plan, passengers });
    expect(ret).toHaveBeenCalledTimes(3);
    expect(requests).toBe(3);
    expect(failures).toBe(0);
    expect(new Set(trips.map((t) => t.slices[0].to))).toEqual(new Set(["IST", "SAW"]));
  });

  it("keeps going when a request fails, and counts the failure", async () => {
    const mock = createMockProvider();
    let calls = 0;
    const flaky: FlightProvider = {
      ...mock,
      searchReturn: async (q) => {
        if (++calls === 2) throw new Error("429");
        return mock.searchReturn(q);
      },
    };
    const { trips, failures } = await widenTrips(flaky, { queries: plan, passengers });
    expect(failures).toBe(1);
    expect(trips.length).toBeGreaterThan(0);
  });

  it("never has more than `concurrency` requests in flight", async () => {
    const mock = createMockProvider();
    let active = 0;
    let peak = 0;
    const slow: FlightProvider = {
      ...mock,
      searchReturn: async (q) => {
        peak = Math.max(peak, ++active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return mock.searchReturn(q);
      },
    };
    await widenTrips(slow, { queries: plan, passengers, concurrency: 2 });
    expect(peak).toBe(2);
  });
});

describe("splitFallback", () => {
  it("makes two one-way requests and returns separate-ticket trips", async () => {
    const mock = createMockProvider();
    const oneWay = vi.spyOn(mock, "searchOneWay");
    const trips = await splitFallback(mock, { query: { from: "AMM", to: "IST", ...targetDates(window) }, passengers });
    expect(oneWay).toHaveBeenCalledTimes(2);
    expect(trips.length).toBeGreaterThan(0);
    expect(trips.every((t) => t.kind === "split" && t.fares.length === 2)).toBe(true);
  });
});

describe("end to end", () => {
  it("one search feeds the ranking", async () => {
    const trips = await searchTrips(createMockProvider(), { query: { from: "AMM", to: "IST", ...targetDates(window) }, passengers });
    const r = rank(trips, rankOpts);
    expect(r.valid.length + r.rejected.length).toBe(trips.length);
  });
});
