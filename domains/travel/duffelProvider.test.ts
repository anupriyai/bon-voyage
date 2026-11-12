import { describe, expect, it, vi } from "vitest";
import { createDuffelProvider, mapOffer, type DuffelSearchClient } from "./duffelProvider";
import { cacheProvider } from "./providerCache";
const now = () => Date.parse("2027-01-01T00:00:00Z");
export const offerFixture = {
  id: "off_fixture", total_amount: "412.50", total_currency: "GBP", live_mode: false, expires_at: "2027-01-01T00:10:00Z",
  payment_requirements: { requires_instant_payment: false }, passengers: [{ id: "pas_fixture", type: "adult" }],
  conditions: { refund_before_departure: { allowed: true, penalty_amount: "10", penalty_currency: "GBP" }, change_before_departure: { allowed: false } },
  slices: [{ origin: { iata_code: "AMM" }, destination: { iata_code: "LHR" }, segments: [{ origin: { iata_code: "AMM", time_zone: "Asia/Amman" }, destination: { iata_code: "LHR", time_zone: "Europe/London" }, departing_at: "2027-01-20T09:00:00", arriving_at: "2027-01-20T12:00:00", operating_carrier: { iata_code: "RJ", name: "Royal Jordanian" }, operating_carrier_flight_number: "111" }] }],
};
const returnFixture = { ...offerFixture, slices: [...offerFixture.slices, { origin: { iata_code: "LHR" }, destination: { iata_code: "AMM" }, segments: [{ ...offerFixture.slices[0].segments[0], origin: { iata_code: "LHR", time_zone: "Europe/London" }, destination: { iata_code: "AMM", time_zone: "Asia/Amman" }, departing_at: "2027-01-30T10:00:00", arriving_at: "2027-01-30T18:00:00" }] }] };
const query = { from: "AMM", to: "LHR", out: "2027-01-20", back: "2027-01-30", passengers: [{ type: "adult" as const }], maxConnections: 1 as const };
describe("Duffel search adapter", () => {
  it("creates exactly one two-slice request then lists sorted offers", async () => {

    const client: DuffelSearchClient = { create: vi.fn(async () => ({ id: "orq_fixture" })), list: vi.fn(async () => [returnFixture]), get: vi.fn(async () => offerFixture) };
    const provider = createDuffelProvider({ token: "duffel_test_fake", client, now });
    const fares = await provider.searchReturn(query);
    expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ slices: [{ origin: "AMM", destination: "LHR", departure_date: query.out }, { origin: "LHR", destination: "AMM", departure_date: query.back }], max_connections: 1, supplier_timeout: 10000, return_offers: false }));
    expect(client.list).toHaveBeenCalledWith("orq_fixture");
    expect(fares[0]).toMatchObject({ totalAmount: 412.5, currency: "GBP", holdable: true, passengerIds: ["pas_fixture"] });
    expect(fares[0].slices[0].segments[0]).toMatchObject({ departAt: "2027-01-20T09:00:00+03:00", arriveAt: "2027-01-20T12:00:00+00:00", carrierName: "Royal Jordanian" });
  });
  it("does not turn unavailable offers, expired offers or wrong modes into bookable fares", async () => {
    const client: DuffelSearchClient = { create: async () => ({ id: "orq" }), list: async () => [], get: async () => { throw { status: 404 }; } };
    expect(await createDuffelProvider({ token: "duffel_test_fake", client, now }).reprice("off_missing")).toBeNull();
    expect(() => mapOffer({ ...offerFixture, live_mode: true }, false, now())).toThrow();
    expect(() => mapOffer({ ...offerFixture, expires_at: "2020-01-01T00:00:00Z" }, false, now())).toThrow();
  });
  it("bounds cache lifetime by offer expiry and always reprices fresh", async () => {
    let time = now();
    const source = createDuffelProvider({ token: "duffel_test_fake", now: () => time, client: { create: async () => ({ id: "orq" }), list: async () => [returnFixture], get: vi.fn(async () => offerFixture) } });
    const search = vi.spyOn(source, "searchReturn"); const reprice = vi.spyOn(source, "reprice");
    const cached = cacheProvider(source, () => time);
    await cached.searchReturn(query); await cached.searchReturn(query);
    expect(search).toHaveBeenCalledTimes(1);
    await cached.reprice("off_fixture"); await cached.reprice("off_fixture"); expect(reprice).toHaveBeenCalledTimes(2);
    time += 11 * 60000;
    await cached.searchReturn(query); expect(search).toHaveBeenCalledTimes(2);
  });
});
