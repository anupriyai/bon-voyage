import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFlightSearchHandler } from "./handlers";
import { initialState } from "@/domains/case";
import { createMockProvider } from "@/domains/travel";
import { HttpError } from "@/shared/lib/http";
const id = "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36";
const state = { ...initialState(id), chosenId: "istanbul" as const };
state.intake.origin = "jordan";
const schedule = { appointment: "2027-01-20", treatmentDays: 7, recoveryDays: 10, passengers: 2, wheelchair: false };
function request(origin = "https://example.test") { return new Request("https://example.test/api/travel/search", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify({ caseId: id, revision: 1, schedule }) }); }
function setup(signedIn = true) {
  const provider = createMockProvider();
  const search = vi.spyOn(provider, "searchReturn");
  const deps = {
    actorFrom: vi.fn(async () => signedIn ? { id: "owner", type: "user" as const } : null),
    loadCase: vi.fn(async () => ({ state, revision: 1 })),
    reserve: vi.fn(async () => "search-id"),
    snapshots: vi.fn(async () => {}),
    provider: () => provider,
  };
  return { POST: createFlightSearchHandler(deps), deps, search };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("saved-case flight search", () => {
  it("refuses signed-out and cross-site searches before provider or storage calls", async () => {
    const a = setup(false); expect((await a.POST(request())).status).toBe(401);
    expect(a.deps.loadCase).not.toHaveBeenCalled(); expect(a.search).not.toHaveBeenCalled();
    const b = setup(); expect((await b.POST(request("https://other.test"))).status).toBe(403);
    expect(b.search).not.toHaveBeenCalled();
  });
  it("refuses stale cases and exhausted limits without spending provider calls", async () => {
    const a = setup(); a.deps.loadCase.mockResolvedValue({ state, revision: 2 });
    expect((await a.POST(request())).status).toBe(409); expect(a.search).not.toHaveBeenCalled();
    const b = setup(); b.deps.reserve.mockRejectedValue(new HttpError(429, "rate_limited"));
    expect((await b.POST(request())).status).toBe(429); expect(b.search).not.toHaveBeenCalled();
  });
  it("reserves first, saves returned fares, and identifies samples", async () => {
    const { POST, deps, search } = setup();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).sample).toBe(true);
    expect(deps.reserve.mock.invocationCallOrder[0]).toBeLessThan(search.mock.invocationCallOrder[0]);
    expect(deps.snapshots).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
