import { describe, expect, it, vi } from "vitest";
import { bookFlight, type BookingDependencies } from "./booking";
import { createMockProvider } from "./mockProvider";
import { createDuffelTransport } from "./duffelTransport";
import { validateParty, type BookFlightInput } from "./bookingSchema";
const actor = { id: "owner", type: "user" as const };
const input: BookFlightInput = { caseId: "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36", searchId: "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb37", offerId: "offer", attemptId: "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb38", type: "instant", expectedAmount: 500, currency: "USD", acceptedConditions: true, assistance: true, travelers: [{ givenName: "Fake", familyName: "Patient", bornOn: "1980-01-01", title: "mr", gender: "m", email: "fake@example.com", phone: "+12025550123" }] };
describe("booking safety", () => {
  it("does not retry an ambiguous write, even when the response lacks a resource", async () => {
    for (const status of [200, 202, 500, 502]) {
      const fetcher = vi.fn(async () => Response.json({ message: "processing" }, { status }));
      const result = await createDuffelTransport("test", fetcher).write("/air/orders", {}, input.attemptId);
      expect(result.outcome).toBe("checking"); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("retries only a documented safe 503 once with the same correlation id", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValueOnce(Response.json({ data: { id: "ord_test" } }, { status: 201 }));
    const result = await createDuffelTransport("test", fetcher).write("/air/orders", {}, input.attemptId);
    expect(result.outcome).toBe("created"); expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls) expect(call[1]?.headers).toMatchObject({ "x-client-correlation-id": input.attemptId });
    const unavailable = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 503 }));
    expect((await createDuffelTransport("test", unavailable).write("/air/orders", {}, input.attemptId)).outcome).toBe("failed"); expect(unavailable).toHaveBeenCalledTimes(2);
  });
  it("forces a new confirmation for a price change before claiming or booking", async () => {
    const provider = createMockProvider();
    const fare = (await provider.searchReturn({ from: "AMM", to: "IST", out: "2027-01-20", back: "2027-01-30", passengers: [{ type: "adult" }] }))[0];
    const deps = { hashSecret: "test-only", provider: { ...provider, reprice: async () => fare }, store: { attempt: async () => null, snapshot: async () => ({ ...fare, provider: "mock", slices: fare.slices }), claim: vi.fn() } } as unknown as BookingDependencies;
    await expect(bookFlight(actor, { ...input, offerId: fare.id, expectedAmount: fare.totalAmount + 10 }, deps)).rejects.toMatchObject({ code: "price_changed" });
    expect(deps.store.claim).not.toHaveBeenCalled();
  });
  it("rejects an infant without an adult and expired documents", () => {
    expect(() => validateParty({ ...input, travelers: [{ ...input.travelers[0], bornOn: "2026-12-01" }] }, "2027-01-20")).toThrow();
    expect(() => validateParty({ ...input, travelers: [{ ...input.travelers[0], document: { number: "FAKE123", issuingCountry: "US", expiresOn: "2020-01-01" } }] }, "2027-01-20")).toThrow();
  });
});
