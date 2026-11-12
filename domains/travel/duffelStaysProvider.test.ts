import { describe, expect, it, vi } from "vitest";
import { createDuffelStaysProvider } from "./duffelStaysProvider";
describe("Duffel Stays request contract (synthetic SDK-shaped fixtures)", () => {
  it("keeps result/rate/quote IDs separate, preserves null fees and sends the verified special-request field", async () => {
    const hotel = { id: "acc_fake", name: "Fake Accessible Hotel", amenities: [{ type: "accessibility_mobility" }], location: { geographic_coordinates: { latitude: 41, longitude: 29 } } };
    const rate = { id: "rat_fake", total_amount: "800.00", total_currency: "GBP", due_at_accommodation_amount: null, due_at_accommodation_currency: "GBP", conditions: [{ title: "Cancellation", description: "Fixture conditions" }] };
    const limiter = { consume: vi.fn(async () => {}), observe: vi.fn(async () => {}) };
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === "/stays/search") return Response.json({ data: { results: [{ id: "srr_fake", accommodation: hotel, cheapest_rate_total_amount: "800.00", cheapest_rate_currency: "GBP" }] } });
      if (path.includes("fetch_all_rates")) return Response.json({ data: { accommodation: { rooms: [{ rates: [rate] }] } } });
      if (path === "/stays/quotes") return Response.json({ data: { ...rate, id: "quo_fake", accommodation: hotel, check_in_date: "2027-01-01", check_out_date: "2027-01-10" } });
      const payload = JSON.parse(String(init?.body)).data;
      expect(payload.accommodation_special_requests).toContain("Step-free access"); expect(payload.payment).toBeUndefined();
      return Response.json({ data: { id: "boo_fake", status: "confirmed", reference: "FAKE", metadata: payload.metadata, live_mode: false } }, { status: 201 });
    });
    const provider = createDuffelStaysProvider("duffel_test_fake", fetcher, limiter);
    const today = new Date().toISOString().slice(0, 10); const day = (n: number) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
    const result = (await provider.search({ checkIn: day(30), checkOut: day(39), rooms: 1, guests: 1, latitude: 41, longitude: 29, radiusKm: 5, wheelchair: true }))[0];
    expect(result.resultId).toBe("srr_fake"); expect(result.mobility).toBe(true);
    const rates = await provider.rates(result.resultId); expect(rates[0].rateId).toBe("rat_fake");
    const quote = await provider.quote(rates[0].rateId); expect(quote.quoteId).toBe("quo_fake"); expect(quote.dueAtAccommodation).toBeNull();
    const booking = await provider.book(quote, { attemptId: "fake-attempt", email: "fake@example.com", phone: "+12025550123", guests: [{ givenName: "Fake", familyName: "Guest" }], wheelchair: true });
    expect(booking.outcome).toBe("created"); expect(booking.receipt?.attemptId).toBe("fake-attempt");
    expect(limiter.consume).toHaveBeenCalledTimes(4);
  });
});
