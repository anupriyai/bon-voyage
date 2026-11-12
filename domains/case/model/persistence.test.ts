import { describe, expect, it } from "vitest";
import { initialState } from "./caseState";
import { SaveCaseSchema, TravelerSchema, safeReturnPath } from "./persistence";

const id = "a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36";

describe("case persistence input", () => {
  it("validates a complete working copy and preserves validated travel selections", () => {
    const state = { ...initialState(id), travelSchedule: { appointment: "2027-01-20", treatmentDays: 7, recoveryDays: 14, passengers: 2, wheelchair: true, flexDays: 1 as const } };
    expect(SaveCaseSchema.parse({ state, revision: null }).state).toEqual(state);
  });
  it("refuses invalid IDs, missing versions and invalid clinical choices", () => {
    expect(SaveCaseSchema.safeParse({ state: initialState("other-user") }).success).toBe(false);
    expect(SaveCaseSchema.safeParse({ state: initialState(id) }).success).toBe(false);
    expect(SaveCaseSchema.safeParse({ state: { ...initialState(id), intake: { ...initialState(id).intake, stage: "9" } }, revision: null }).success).toBe(false);
  });
  it("rejects impossible appointment dates and excessive lengths", () => {
    expect(SaveCaseSchema.safeParse({ state: initialState(id), revision: null, schedule: { appointmentDate: "2027-02-30" } }).success).toBe(false);
    expect(SaveCaseSchema.safeParse({ state: initialState(id), revision: null, schedule: { treatmentDays: -1 } }).success).toBe(false);
  });
  it("rejects unvalidated passport fields in the saved case payload", () => {
    expect(SaveCaseSchema.safeParse({ state: { ...initialState(id), passportNumber: "FAKE123" }, revision: null }).success).toBe(false);
  });
  it("does not accept stored passport numbers or arbitrary traveler health fields", () => {
    expect(TravelerSchema.safeParse({ givenName: "Test", familyName: "Patient", role: "patient", bornOn: "1980-01-01", needs: [], passportNumber: "SECRET" }).success).toBe(false);
  });
  it("allows only local return paths", () => {
    expect(safeReturnPath("/case/records")).toBe("/case/records");
    expect(safeReturnPath("/explore/trip?offer=sample&from=JFK")).toBe("/explore/trip?offer=sample&from=JFK");
    expect(safeReturnPath("/explore/trip?plan=a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36")).toBe("/explore/trip?plan=a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36");
    expect(safeReturnPath("/explore/trip/elsewhere")).toBe("/account");
    for (const path of ["//evil.example", "/\\evil.example", "https://evil.example", "/api/auth/sign-out", "/login"]) {
      expect(safeReturnPath(path)).toBe("/account");
    }
  });
});
