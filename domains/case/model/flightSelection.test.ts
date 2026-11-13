import { describe, expect, it } from "vitest";
import { initialState, flightContext, selectedFlightFor, updatedFlightPrice } from "./caseState";
import { applyFlightCost, buildPlan, evaluateAll } from "./engine";
const state = initialState("a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36");
state.intake.origin = "jordan";
state.chosenId = "istanbul";
state.travelSchedule = { appointment: "2027-01-20", treatmentDays: 7, recoveryDays: 10, passengers: 2, wheelchair: false, flexDays: 1 };
describe("selected flight estimate", () => {
  it("replaces the sample flight amount while keeping local transport in all totals", () => {
    const option = evaluateAll(state.intake).find((o) => o.hospital.id === "istanbul")!;
    const next = applyFlightCost(option, 400);
    expect(next.lines.find((l) => l.id === "travel")?.expected).toBe(400 + option.route.local);
    expect(next.totals.expected).toBe(option.totals.expected - option.lines.find((l) => l.id === "travel")!.expected + 400 + option.route.local);
  });
  it("updates a repriced flight without losing fees or extra transfers", () => {
    const selected = { id: "offer", amount: 550, currency: "GBP", fareAmount: 500, fees: 10, extraGround: 40, context: "test", from: "AMM", to: "IST", out: "2027-01-18", back: "2027-02-06", sample: false, selectedAt: new Date().toISOString() };
    expect(updatedFlightPrice(selected, 600, 1.25)).toMatchObject({ fareAmount: 600, amount: 650, usdAmount: 812.5, fees: 10, extraGround: 40 });
  });
  it("shows the selected flight dates and planning appointment in the plan", () => {
    const option = evaluateAll(state.intake).find((o) => o.hospital.id === "istanbul")!;
    const plan = buildPlan(state.intake, option, "2027-01-01T12:00:00Z", { appointment: "2027-01-20", out: "2027-01-18", back: "2027-02-06" });
    expect(plan.first.getDate()).toBe(20);
    expect(plan.travel.getDate()).toBe(18);
    expect(plan.home.getMonth()).toBe(1);
    expect(plan.home.getDate()).toBe(6);
  });
  it("invalidates a selected fare when the hospital or travel details change", () => {
    const selected = { ...state, flightSelection: { id: "offer", amount: 400, currency: "USD" as const, context: flightContext(state), from: "AMM", to: "IST", out: "2027-01-18", back: "2027-02-06", sample: true, selectedAt: new Date().toISOString() } };
    expect(selectedFlightFor(selected)?.amount).toBe(400);
    expect(selectedFlightFor({ ...selected, chosenId: "berlin" })).toBeNull();
    expect(selectedFlightFor({ ...selected, intake: { ...selected.intake, originCity: "Jeddah" } })).toBeNull();
    expect(selectedFlightFor({ ...selected, travelSchedule: { ...state.travelSchedule!, passengers: 3 } })).toBeNull();
  });
});
