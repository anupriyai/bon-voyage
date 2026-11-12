import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/domains/case";
import { createMockProvider } from "@/domains/travel";
import { findOptions, flightQuery } from "./findOptions";

const state = { ...initialState("a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36"), chosenId: "istanbul" as const };
state.intake = { ...state.intake, origin: "saudi", originCity: "Jeddah", stage: "3" };
const schedule = { appointment: "2027-01-20", treatmentDays: 7, recoveryDays: 10, passengers: 2, wheelchair: false };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("case flight options", () => {
  it("maps the actual origin city, makes one round-trip search and explains its picks", async () => {
    const provider = createMockProvider();
    const spy = vi.spyOn(provider, "searchReturn");
    const result = await findOptions(state, schedule, provider);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ from: "JED", to: "IST" });
    expect(result.sample).toBe(true);
    expect(result.ranking.picks.balanced?.why).toBeTruthy();
    expect(result.calendar.every((c) => result.ranking.valid.some((v) => v.trip.slices[0].segments[0].departAt.startsWith(c.day)))).toBe(true);
  });
  it("widens at most twice and keeps calendar days inside the clinical window", async () => {
    const provider = createMockProvider();
    const spy = vi.spyOn(provider, "searchReturn");
    const result = await findOptions(state, { ...schedule, widen: true }, provider);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.extraRequests).toBe(2);
    expect(result.calendar.every((c) => result.window.outbound.includes(c.day))).toBe(true);
    expect(result.ranking.rejected.every((r) => r.reasons.length)).toBe(true);
  });
  it("searches children by age and includes an infant only with an adult", () => {
    const query = flightQuery(state, { ...schedule, passengers: 4, companionAges: [7, 1, 40] });
    expect(query.passengers.map((p) => p.type)).toEqual(["adult", "child", "infant_without_seat", "adult"]);
    expect(() => flightQuery({ ...state, intake: { ...state.intake, age: "1" } }, { ...schedule, passengers: 1 })).toThrow();
  });
  it("refuses impossible dates, past travel and unmapped origins before provider calls", async () => {
    const provider = createMockProvider();
    const spy = vi.spyOn(provider, "searchReturn");
    await expect(findOptions(state, { ...schedule, appointment: "2027-02-30" }, provider)).rejects.toThrow();
    await expect(findOptions(state, { ...schedule, appointment: "2020-01-01" }, provider)).rejects.toThrow();
    await expect(findOptions({ ...state, intake: { ...state.intake, origin: "other", originCity: "Unknown" } }, schedule, provider)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
