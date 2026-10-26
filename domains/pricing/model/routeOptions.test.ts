import { describe, expect, it } from "vitest";
import { combine, groundTransfer, planWiden } from "@/domains/pricing/model/routeOptions";
import { fare, seg, slice } from "@/domains/pricing/model/testFares";

describe("groundTransfer", () => {
  it("is free and instant at the main airport", () => {
    expect(groundTransfer(0)).toEqual({ cost: 0, hours: 0 });
  });
  it("grows with distance", () => {
    const t = groundTransfer(100);
    expect(t.cost).toBeGreaterThan(0);
    expect(t.hours).toBeGreaterThan(1);
    expect(groundTransfer(200).cost).toBeGreaterThan(t.cost);
  });
});

describe("planWiden", () => {
  const window = { outbound: ["d1", "d2", "d3", "d4"], return: ["r1", "r2", "r3"] };
  const base = { origins: ["AMM"], destinations: ["IST"], window, target: { out: "d4", back: "r1" } };

  it("never repeats the search already made at the target dates", () => {
    const plan = planWiden({ ...base, budget: 100 });
    expect(plan).not.toContainEqual({ from: "AMM", to: "IST", out: "d4", back: "r1" });
    expect(plan).toHaveLength(4 * 3 - 1);
  });

  it("tries the dates closest to the target first, and stops at the budget", () => {
    const plan = planWiden({ ...base, budget: 3 });
    expect(plan).toHaveLength(3);
    // One day off the target, either way.
    expect(plan).toEqual(
      expect.arrayContaining([
        { from: "AMM", to: "IST", out: "d3", back: "r1" },
        { from: "AMM", to: "IST", out: "d4", back: "r2" },
      ]),
    );
  });

  it("weighs an alternate airport like 1.5 days off the target", () => {
    const plan = planWiden({ ...base, destinations: ["IST", "SAW"], budget: 4 });
    // IST one day off (1), then SAW at the target dates (1.5), then IST two days off (2).
    expect(plan.slice(0, 2).every((q) => q.to === "IST")).toBe(true);
    expect(plan[2]).toEqual({ from: "AMM", to: "SAW", out: "d4", back: "r1" });
    expect(plan[3].to).toBe("IST");
  });
});

describe("combine", () => {
  const out1 = fare("o1", 200, slice(seg("AMM", "IST", "2026-11-07T08:00:00+03:00", 2.5)));
  const out2 = fare("o2", 150, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 2.5)));
  const back1 = fare("b1", 180, slice(seg("IST", "AMM", "2026-11-18T10:00:00+03:00", 2.5)));
  const backEur = { ...fare("b2", 90, slice(seg("IST", "AMM", "2026-11-19T10:00:00+03:00", 2.5))), currency: "EUR" };

  it("pairs one-ways in the same currency as separate tickets, cheapest first", () => {
    const trips = combine([out1, out2], [back1, backEur]);
    expect(trips.map((t) => t.id)).toEqual(["o2+b1", "o1+b1"]);
    expect(trips[0]).toMatchObject({ kind: "split", totalAmount: 330, currency: "USD" });
    expect(trips[0].slices).toHaveLength(2);
  });

  it("drops a return that leaves before the outbound lands", () => {
    const early = fare("e", 50, slice(seg("IST", "AMM", "2026-11-07T09:00:00+03:00", 2.5)));
    expect(combine([out1], [early])).toEqual([]);
  });

  it("treats a two-slice fare as one round-trip ticket", () => {
    const rt = fare("rt", 300, slice(seg("AMM", "IST", "2026-11-07T08:00:00+03:00", 2.5)), slice(seg("IST", "AMM", "2026-11-18T10:00:00+03:00", 2.5)));
    const trips = combine([], [], [rt]);
    expect(trips[0]).toMatchObject({ id: "rt", kind: "return", totalAmount: 300 });
  });

  it("adds ground transfers at every airport the trip uses, both sides", () => {
    const trips = combine([out1], [back1], [], { groundByAirport: { AMM: { cost: 40, hours: 1 }, IST: { cost: 25, hours: 1.5 } } });
    // Home → AMM, IST → hospital, hospital → IST, AMM → home.
    expect(trips[0].groundCost).toBe(130);
    expect(trips[0].groundHours).toBe(5);
  });

  it("adds booking fees per ticket, so two separate tickets cost more", () => {
    const rt = fare("rt", 330, slice(seg("AMM", "IST", "2026-11-08T08:00:00+03:00", 2.5)), slice(seg("IST", "AMM", "2026-11-18T10:00:00+03:00", 2.5)));
    const fees = { perOrder: 3, pct: 1 };
    const [split] = combine([out2], [back1], [], { fees });
    const [ret] = combine([], [], [rt], { fees });
    expect(ret.fees).toBeCloseTo(3 + 3.3);
    expect(split.fees).toBeCloseTo(2 * 3 + 1.5 + 1.8);
  });
});
