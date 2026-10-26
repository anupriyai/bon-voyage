import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/domains/travel/mockProvider";

const adult = [{ type: "adult" as const }];

describe("mock flight provider", () => {
  const mock = createMockProvider();

  it("returns the same fares for the same search", async () => {
    const a = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: adult });
    const b = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: adult });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
  });

  it("varies by date", async () => {
    const a = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: adult });
    const b = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-09", passengers: adult });
    expect(a.map((f) => f.totalAmount)).not.toEqual(b.map((f) => f.totalAmount));
  });

  it("produces well-formed one-way fares on the requested day and route", async () => {
    const fares = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: adult });
    for (const f of fares) {
      expect(f.provider).toBe("mock");
      expect(f.slices).toHaveLength(1);
      const s = f.slices[0];
      expect(s.from).toBe("AMM");
      expect(s.to).toBe("IST");
      expect(s.segments[0].departAt.slice(0, 10)).toBe("2026-11-08");
      for (let i = 1; i < s.segments.length; i++) {
        expect(Date.parse(s.segments[i].departAt)).toBeGreaterThan(Date.parse(s.segments[i - 1].arriveAt));
      }
      expect(f.totalAmount).toBeGreaterThan(0);
    }
  });

  it("respects maxConnections", async () => {
    const fares = await mock.searchOneWay({ from: "AMM", to: "BER", date: "2026-11-08", passengers: adult, maxConnections: 0 });
    expect(fares.every((f) => f.slices[0].segments.length === 1)).toBe(true);
  });

  it("charges per passenger", async () => {
    const one = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: adult });
    const two = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: [...adult, ...adult] });
    expect(two[0].totalAmount).toBeCloseTo(one[0].totalAmount * 2);
  });

  it("returns two-slice return fares", async () => {
    const fares = await mock.searchReturn({ from: "AMM", to: "IST", out: "2026-11-08", back: "2026-11-18", passengers: adult });
    expect(fares.length).toBeGreaterThan(0);
    expect(fares[0].slices.map((s) => [s.from, s.to])).toEqual([["AMM", "IST"], ["IST", "AMM"]]);
  });

  it("reprices a fare it issued, and returns null for unknown ids", async () => {
    const [f] = await mock.searchOneWay({ from: "AMM", to: "IST", date: "2026-11-08", passengers: adult });
    expect(await mock.reprice(f.id)).toEqual(f);
    expect(await mock.reprice("nope")).toBeNull();
  });

  it("returns nothing for an airport it does not know", async () => {
    expect(await mock.searchOneWay({ from: "AMM", to: "XXX", date: "2026-11-08", passengers: adult })).toEqual([]);
  });
});
