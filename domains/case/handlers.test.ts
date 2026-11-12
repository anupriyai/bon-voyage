import { describe, expect, it, vi } from "vitest";
import { createCaseHandlers } from "./handlers";
import { CaseError } from "./store";
import { initialState } from "./model/caseState";
const id = "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36";
const actor = { id: "owner-a", type: "user" as const };
function setup(signedIn = true) {
  const store = { loadCase: vi.fn(), listCases: vi.fn().mockResolvedValue([]), saveCase: vi.fn(), deleteCase: vi.fn() };
  const handlers = createCaseHandlers(async () => signedIn ? actor : null, () => store);
  return { store, ...handlers };
}
function put(body: unknown, origin = "https://example.test") {
  return new Request("https://example.test/api/case", { method: "PUT", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
}
describe("owned case routes", () => {
  it("rejects signed-out requests before touching storage", async () => {
    const { store, GET, PUT, DELETE } = setup(false);
    expect((await GET(new Request("https://example.test/api/case"))).status).toBe(401);
    expect((await PUT(put({}))).status).toBe(401);
    expect((await DELETE(new Request(`https://example.test/api/case?id=${id}&revision=1`, { method: "DELETE" }))).status).toBe(401);
    expect(store.listCases).not.toHaveBeenCalled(); expect(store.saveCase).not.toHaveBeenCalled();
  });
  it("rejects cross-site writes and malformed payloads without leaking submitted content", async () => {
    const { PUT, store } = setup();
    expect((await PUT(put({}, "https://other.test"))).status).toBe(403);
    const response = await PUT(put({ state: { patientName: "SECRET" } }));
    expect(response.status).toBe(400); expect(await response.text()).not.toContain("SECRET");
    expect(store.saveCase).not.toHaveBeenCalled();
  });
  it("enforces the body size limit before parsing", async () => {
    const { PUT } = setup();
    expect((await PUT(put({ large: "x".repeat(260000) }))).status).toBe(413);
  });
  it("passes the authenticated actor, never an owner in the submitted data", async () => {
    const { PUT, store } = setup(); store.saveCase.mockResolvedValue({ state: initialState(id), revision: 1 });
    const body = { state: { ...initialState(id), intake: { ...initialState(id).intake, ownerId: "other-user" } }, revision: null };
    expect((await PUT(put(body))).status).toBe(200);
    expect(store.saveCase.mock.calls[0][0]).toEqual(actor);
  });
  it("returns not found for another user's case and conflict for a stale version", async () => {
    const { GET, PUT, store } = setup();
    store.loadCase.mockRejectedValue(new CaseError("not_found", 404));
    expect((await GET(new Request(`https://example.test/api/case?id=${id}`))).status).toBe(404);
    store.saveCase.mockRejectedValue(new CaseError("conflict", 409));
    expect((await PUT(put({ state: initialState(id), revision: 1 }))).status).toBe(409);
  });
});
