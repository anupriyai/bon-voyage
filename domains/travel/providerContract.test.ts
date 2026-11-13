import { describe, expect, it } from "vitest";
import { createMockProvider } from "./mockProvider";
import { createDuffelProvider } from "./duffelProvider";
import type { FlightProvider } from "./flightProvider";
const token = process.env.DUFFEL_ACCESS_TOKEN;
const realTest = process.env.RUN_DUFFEL_CONTRACT === "1" && token?.startsWith("duffel_test_");
function contract(make: () => FlightProvider) {
  it("returns comparable round trips and freshly reprices an issued offer", async () => {
    const provider = make(); const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const fares = await provider.searchReturn({ from: "AMM", to: "IST", out: day(30), back: day(40), passengers: [{ type: "adult" }], maxConnections: 1 });
    expect(fares.length).toBeGreaterThan(0);
    for (const fare of fares) { expect(fare.slices).toHaveLength(2); expect(fare.currency).toMatch(/^[A-Z]{3}$/); expect(fare.totalAmount).toBeGreaterThan(0); expect(fare.slices[0].from).toBe("AMM"); expect(fare.slices[1].to).toBe("AMM"); }
    const fresh = await provider.reprice(fares[0].id); expect(fresh?.id).toBe(fares[0].id);
  }, 45000);
}
describe("flight provider contract: mock (always)", () => contract(createMockProvider));
// Explicit opt-in: CI and ordinary tests never spend provider quota or call live mode.
describe.skipIf(!realTest)("flight provider contract: Duffel test account (explicit opt-in)", () => contract(() => createDuffelProvider({ token: token! })));
