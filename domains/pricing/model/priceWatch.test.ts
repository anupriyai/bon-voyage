import { describe, expect, it } from "vitest";
import { checkWatch, isDrop, priceCalendar } from "@/domains/pricing/model/priceWatch";
import { combine } from "@/domains/pricing/model/routeOptions";
import { fare, seg, slice } from "@/domains/pricing/model/testFares";

describe("isDrop", () => {
  it("is false with no previous price", () => {
    expect(isDrop(null, 100)).toBe(false);
  });
  it("needs 5% or $30 below the baseline", () => {
    expect(isDrop(1000, 960)).toBe(true); // $40 and 4%: the $30 rule
    expect(isDrop(200, 189)).toBe(true); // $11 but 5.5%: the 5% rule
    expect(isDrop(1000, 975)).toBe(false); // $25 and 2.5%
    expect(isDrop(1000, 1000)).toBe(false);
    expect(isDrop(1000, 1100)).toBe(false);
  });
  it("counts exactly 5% and exactly $30 as a drop, despite floating point", () => {
    expect(isDrop(101, 95.95)).toBe(true);
    expect(isDrop(1000, 970)).toBe(true);
  });
  it("accepts custom thresholds", () => {
    expect(isDrop(1000, 975, { pct: 2, amount: 1000 })).toBe(true);
  });
});

describe("checkWatch", () => {
  it("records the first price without alerting", () => {
    expect(checkWatch({ baseline: null, lowest: null }, 500)).toEqual({ baseline: 500, lowest: 500, alert: null });
  });
  it("alerts on a drop from the baseline and moves the baseline to the alerted price", () => {
    expect(checkWatch({ baseline: 500, lowest: 500 }, 450)).toEqual({ baseline: 450, lowest: 450, alert: { from: 500, to: 450 } });
  });
  it("tracks a small dip as the lowest seen without moving the baseline", () => {
    expect(checkWatch({ baseline: 500, lowest: 500 }, 490)).toEqual({ baseline: 500, lowest: 490, alert: null });
  });
  it("alerts once a slow decline adds up to a real drop", () => {
    let state: { baseline: number | null; lowest: number | null } = { baseline: 1000, lowest: 1000 };
    const alerts = [];
    for (const price of [990, 980, 975, 969]) {
      const next = checkWatch(state, price);
      if (next.alert) alerts.push(next.alert);
      state = next;
    }
    expect(alerts).toEqual([{ from: 1000, to: 969 }]);
  });
  it("ignores a rise", () => {
    expect(checkWatch({ baseline: 500, lowest: 480 }, 600)).toEqual({ baseline: 500, lowest: 480, alert: null });
  });
  it("does nothing when no fare was found", () => {
    expect(checkWatch({ baseline: 500, lowest: 500 }, null)).toEqual({ baseline: 500, lowest: 500, alert: null });
  });
});

describe("priceCalendar", () => {
  const back = fare("b", 100, slice(seg("IST", "AMM", "2026-11-18T10:00:00+03:00", 2)));
  const trips = combine(
    [
      fare("a", 300, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 2))),
      fare("b2", 250, slice(seg("AMM", "IST", "2026-11-08T20:00:00+03:00", 2))),
      fare("c", 200, slice(seg("AMM", "IST", "2026-11-07T08:00:00+03:00", 2))),
    ],
    [back],
  );

  it("gives the cheapest total per outbound day, in day order", () => {
    expect(priceCalendar(trips, "USD")).toEqual([
      { day: "2026-11-07", amount: 300, currency: "USD" },
      { day: "2026-11-08", amount: 350, currency: "USD" },
    ]);
  });

  it("never compares across currencies", () => {
    const eur = combine([{ ...fare("e", 10, slice(seg("AMM", "IST", "2026-11-07T09:00:00+03:00", 2))), currency: "EUR" }], [{ ...back, currency: "EUR" }]);
    expect(priceCalendar([...trips, ...eur], "USD")[0]).toEqual({ day: "2026-11-07", amount: 300, currency: "USD" });
  });
});
