import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/domains/providers";
import { ORIGINS, ORIGIN_BY_ID } from "@/domains/case/data/catalogue";
import { CaseStateSchema } from "./persistence";
import { initialState } from "./caseState";

describe("guided journey home country", () => {
  it("offers every standard country and territory once", () => {
    const selectable = ORIGINS.filter((origin) => origin.id !== "other");
    expect(selectable).toHaveLength(COUNTRIES.length);
    expect(new Set(selectable.map((origin) => origin.id)).size).toBe(COUNTRIES.length);
    for (const country of COUNTRIES) {
      const legacy = ({ JO: "jordan", SA: "saudi", AE: "uae", LB: "lebanon", EG: "egypt", GB: "uk", NZ: "nz" } as Record<string, string>)[country.code];
      expect(ORIGIN_BY_ID[legacy ?? country.code]?.label).toBeTruthy();
    }
  });
  it("accepts a newly selectable home country and rejects an invented one", () => {
    const base = initialState("a5c89e9a-55de-4c6c-8f36-2b5f41f9eb36");
    const intake = { ...base.intake, origin: "AF", originCity: "Kabul" };
    expect(CaseStateSchema.safeParse({ ...base, intake }).success).toBe(true);
    expect(CaseStateSchema.safeParse({ ...base, intake: { ...intake, origin: "MADE_UP" } }).success).toBe(false);
  });
});
