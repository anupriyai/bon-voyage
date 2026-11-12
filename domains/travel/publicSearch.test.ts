import { afterEach, describe, expect, it, vi } from "vitest";
import { OFFERS } from "@/domains/providers/archivedSampleOffers";
import { HttpError } from "@/shared/lib/http";
import { createPublicTravelHandler, publicSampleFlights, publicSampleStays, verifyCareTravelSelection } from "./publicSearch";

const now = Date.parse("2027-01-01T12:00:00Z");
const offer = OFFERS[0];
const query = { offerId: offer.id, from: "JFK", out: "2027-02-10", back: "2027-02-20", travellers: 2 };
const stayQuery = { offerId: offer.id, out: query.out, back: query.back, travellers: query.travellers };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("public sample travel", () => {
  it("stays sample-only with configured live credentials and never calls the network", async () => {
    vi.stubEnv("DUFFEL_ACCESS_TOKEN", "duffel_live_not-a-real-token"); vi.stubEnv("DUFFEL_STAYS_ENABLED", "true");
    const network = vi.fn(() => { throw new Error("no network expected"); }); vi.stubGlobal("fetch", network);
    const fares = await publicSampleFlights(query, now); const stays = await publicSampleStays(stayQuery, now);
    expect(fares.length).toBeGreaterThan(0); expect(fares.every((fare) => fare.provider === "mock" && fare.currency === "USD")).toBe(true);
    expect(stays.length).toBe(3); expect(stays[0].quote.quoteId).toMatch(/^sample_care_stay_/); expect(network).not.toHaveBeenCalled();
  });
  it("supports every catalogue destination and deterministic all-adult party prices", async () => {
    for (const destination of [...new Map(OFFERS.map((item) => [item.airport, item])).values()]) {
      const fares = await publicSampleFlights({ ...query, offerId: destination.id }, now);
      expect(fares.length, destination.airport).toBeGreaterThan(0); expect(fares[0].slices[0].to).toBe(destination.airport);
    }
    const one = await publicSampleFlights({ ...query, travellers: 1 }, now); const two = await publicSampleFlights(query, now);
    expect(two[0].totalAmount).toBe(one[0].totalAmount * 2);
    expect((await publicSampleFlights(query, now)).map((fare) => fare.id)).toEqual(two.map((fare) => fare.id));
  });
  it("rejects invalid calendar dates, unbounded dates, unknown airports and unknown offers", async () => {
    for (const patch of [{ out: "2027-02-30" }, { out: "2026-12-31" }, { back: query.out }, { back: "2028-02-10" }, { from: "AAA" }, { from: offer.airport }, { offerId: "missing" }]) {
      await expect(publicSampleFlights({ ...query, ...patch }, now)).rejects.toBeInstanceOf(HttpError);
    }
    await expect(publicSampleStays({ ...stayQuery, travellers: 10 }, now)).rejects.toThrow();
  });
  it("regenerates selections, binds stay quotes to offer and party, and expires them", async () => {
    const [fare] = await publicSampleFlights(query, now); const [stay] = await publicSampleStays(stayQuery, now);
    const draft = { ...query, flightId: fare.id, stayQuoteId: stay.quote.quoteId };
    const verified = await verifyCareTravelSelection(draft, now + 1000);
    expect(verified.fare?.totalAmount).toBe(fare.totalAmount); expect(verified.stay?.quote.amount).toBe(stay.quote.amount);
    for (const patch of [{ offerId: OFFERS[1].id }, { travellers: 3 }, { back: "2027-02-21" }, { from: "LAX" }]) {
      await expect(verifyCareTravelSelection({ ...draft, ...patch }, now + 1000)).rejects.toThrow();
    }
    await expect(verifyCareTravelSelection(draft, now + 600001)).rejects.toMatchObject({ status: 409 });
    await expect(verifyCareTravelSelection({ ...draft, stayQuoteId: "garbage" }, now)).rejects.toMatchObject({ status: 400 });
  });
  it("rejects future-issued unsigned sample quotes and validates dates without travel selections", async () => {
    const [stay] = await publicSampleStays(stayQuery, now + 86400000);
    await expect(verifyCareTravelSelection({ ...query, flightId: null, stayQuoteId: stay.quote.quoteId }, now)).rejects.toMatchObject({ status: 409 });
    await expect(verifyCareTravelSelection({ ...query, out: "2026-01-01", flightId: null, stayQuoteId: null }, now)).rejects.toMatchObject({ status: 400 });
    await expect(verifyCareTravelSelection({ ...query, from: "AAA", flightId: null, stayQuoteId: null }, now)).rejects.toMatchObject({ status: 400 });
    await expect(verifyCareTravelSelection({ ...query, from: "", out: "", back: "", flightId: null, stayQuoteId: null }, now)).resolves.toEqual({ fare: null, stay: null });
  });
  it("does not expose fictional care inventory through anonymous travel endpoints", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const handler = createPublicTravelHandler("flights");
    const request = (origin = "https://example.test") => new Request("https://example.test/api/explore/flights", { method: "POST", headers: { "Content-Type": "application/json", origin, "user-agent": "public-search-budget-test" }, body: JSON.stringify(query) });
    expect((await handler(request("https://other.test"))).status).toBe(403);
    const first = await handler(request()); expect(first.status).toBe(404);
    expect((await first.json()).error).toBe("offer_not_found");
  });
});
