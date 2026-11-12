import { describe, expect, it, vi } from "vitest";
import { createCarePlanHandlers } from "./handlers";
import { CarePlanError } from "./store";
import { CarePlanSchema } from "./plan";

const actor = { id: "care-owner", type: "user" as const };
const id = "758fa5c3-fca0-4e6c-a338-c0de369c9b01";
const draft = { offerId: "lima-dental-implants", from: "", out: "", back: "", travellers: 1, flightId: null, stayQuoteId: null };
function setup(signedIn = true) {
  const store = { loadPlan: vi.fn(), listPlans: vi.fn().mockResolvedValue([]), listRequests: vi.fn().mockResolvedValue([]), savePlan: vi.fn(), requestCare: vi.fn() };
  return { store, ...createCarePlanHandlers(async () => signedIn ? actor : null, () => store) };
}
const request = (body: unknown, method = "PUT", origin = "https://example.test") => new Request("https://example.test/api/explore/plans", { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("public care plan input", () => {
  it("accepts treatment-only plans and refuses clinical or monetary fields", () => {
    expect(CarePlanSchema.safeParse(draft).success).toBe(true);
    expect(CarePlanSchema.safeParse({ ...draft, passport: "SECRET" }).success).toBe(false);
    expect(CarePlanSchema.safeParse({ ...draft, priceUsd: 1 }).success).toBe(false);
    expect(CarePlanSchema.safeParse({ ...draft, out: "2027-02-30", back: "2027-03-10" }).success).toBe(false);
    expect(CarePlanSchema.safeParse({ ...draft, flightId: "fake" }).success).toBe(false);
  });
});
describe("owned public care routes", () => {
  it("rejects signed-out access before storage", async () => {
    const { store, GET, PUT, GET_REQUESTS, POST_REQUEST } = setup(false);
    expect((await GET(new Request("https://example.test/api/explore/plans"))).status).toBe(401);
    expect((await PUT(request({ draft }))).status).toBe(401);
    expect((await GET_REQUESTS(new Request("https://example.test/api/explore/requests"))).status).toBe(401);
    expect((await POST_REQUEST(request({}, "POST"))).status).toBe(401);
    expect(store.savePlan).not.toHaveBeenCalled();
  });
  it("rejects cross-site, oversized and malformed mutations without echoing private content", async () => {
    const { PUT, POST_REQUEST, store } = setup();
    expect((await PUT(request({ draft }, "PUT", "https://other.test"))).status).toBe(403);
    expect((await POST_REQUEST(request({}, "POST", "https://other.test"))).status).toBe(403);
    expect((await PUT(request({ draft: { secret: "PRIVATE TEXT" } }))).status).toBe(400);
    expect((await PUT(request({ large: "x".repeat(13000) }))).status).toBe(413);
    expect(store.savePlan).not.toHaveBeenCalled();
  });
  it("keeps owned reads private and refuses new plans for fictional clinics", async () => {
    const { PUT, GET, store } = setup();
    const response = await PUT(request({ draft }));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(store.savePlan).not.toHaveBeenCalled();
    expect(await (await GET(new Request("https://example.test/api/explore/plans"))).json()).toEqual({ plans: [] });
  });
  it("refuses new requests for archived fictional plans without calling the store", async () => {
    const { GET, POST_REQUEST, store } = setup();
    store.loadPlan.mockRejectedValue(new CarePlanError("not_found", 404));
    expect((await GET(new Request(`https://example.test/api/explore/plans?id=${id}`))).status).toBe(404);
    store.loadPlan.mockResolvedValue({ id, revision: 1, draft });
    const response = await POST_REQUEST(request({ planId: id, revision: 1, attemptId: "7de3d842-0eae-4e49-9410-c5fcd793604e" }, "POST"));
    expect(response.status).toBe(404);
    expect(store.requestCare).not.toHaveBeenCalled();
  });
});
