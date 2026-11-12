import { afterEach, describe, expect, it, vi } from "vitest";
import { carePlanApi } from "./plannerClient";

afterEach(() => vi.unstubAllGlobals());
describe("care planner request recovery", () => {
  it("explains a connection failure and allows an explicit retry without changing the submitted choices", async () => {
    const draft = { offerId: "lima-dental-implants", travellers: 2 };
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(Response.json({ plan: { id: "saved" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(carePlanApi("/api/explore/plans", { draft }, "PUT")).rejects.toThrow("Your choices remain on this device");
    expect(await carePlanApi("/api/explore/plans", { draft }, "PUT")).toEqual({ plan: { id: "saved" } });
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  });
  it("does not expose unexpected response contents or parser details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("PRIVATE upstream error", { status: 503 })));
    await expect(carePlanApi("/api/explore/plans")).rejects.toThrow("We couldn’t read that response");
  });
  it("keeps meaningful ownership and expired-selection recovery messages", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "not_found" }, { status: 404 })).mockResolvedValueOnce(Response.json({ error: "selection_expired" }, { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(carePlanApi("/api/explore/plans?id=other-owner")).rejects.toThrow("unavailable for this account");
    await expect(carePlanApi("/api/explore/plans", {}, "PUT")).rejects.toThrow("Refresh flights and stays");
  });
});
