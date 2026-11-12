import { describe, expect, it } from "vitest";
import { createMockStaysProvider } from "./mockStaysProvider";
import { rankStays, stayNights } from "./staysProvider";
const now = () => Date.parse("2026-11-03T12:00:00Z");
const query = { checkIn: "2026-12-01", checkOut: "2026-12-10", rooms: 1, guests: 2, latitude: 41, longitude: 29, radiusKm: 3, wheelchair: true };
describe("Stays search and quote flow", () => {
  it("rejects stays over 99 nights and treats unknown accessibility as unsuitable", async () => {
    expect(() => stayNights({ checkIn: "2026-12-01", checkOut: "2027-04-01" }, "2026-11-03")).toThrow();
    const provider = createMockStaysProvider(now); const ranked = rankStays(await provider.search(query), query);
    expect(ranked).toHaveLength(1); expect(ranked[0].mobility).toBe(true);
  });
  it("requires search result → complete rate → quote, retains unknown property fees", async () => {
    const provider = createMockStaysProvider(now); const result = (await provider.search({ ...query, wheelchair: false }))[2];
    await expect(provider.quote(result.resultId)).rejects.toThrow();
    const rate = (await provider.rates(result.resultId))[0]; const quote = await provider.quote(rate.rateId);
    expect(quote.accommodationId).toBe(result.accommodationId); expect(quote.mobility).toBeNull(); expect(quote.quoteId).not.toBe(rate.rateId); expect(quote.dueAtAccommodation).toBeNull();
    expect((await provider.getQuote(quote.quoteId)).expiresAt).toBe(quote.expiresAt);
  });
});
