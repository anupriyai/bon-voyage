import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./countries";
import { PUBLIC_OFFERS, SPECIALTIES, TREATMENTS, isPublicOfferEligible } from "./catalogue";
import { OFFERS } from "./archivedSampleOffers";
import { parseCareSearch, queryString, searchCare } from "./search";

describe("cancer care public catalogue", () => {
  it("covers every country while exposing only cancer care topics and verified offers", () => {
    expect(COUNTRIES).toHaveLength(249);
    expect(new Set(COUNTRIES.map((item) => item.code)).size).toBe(249);
    expect(new Set(COUNTRIES.map((item) => item.slug)).size).toBe(249);
    expect(SPECIALTIES.map((item) => item.id)).toEqual(["oncology"]);
    expect(TREATMENTS.length).toBeGreaterThan(1);
    expect(TREATMENTS.every((item) => item.specialtyId === "oncology")).toBe(true);
    expect(PUBLIC_OFFERS.every((offer) => offer.provenance === "verified" && TREATMENTS.some((item) => item.id === offer.treatmentId))).toBe(true);
    expect(OFFERS.some((offer) => offer.provenance === "sample")).toBe(true);
  });
  it("does not expose fictional clinics through default search or comparison URLs", () => {
    expect(searchCare(parseCareSearch({})).offers).toEqual([]);
    expect(searchCare(parseCareSearch({ country: "AF" })).total).toBe(0);
    expect(searchCare(parseCareSearch({ q: "dental" })).total).toBe(0);
    expect(parseCareSearch({ compare: OFFERS.slice(0, 4).map((offer) => offer.id).join(",") }).compare).toEqual([]);
  });
  it("requires current review evidence before a cancer offer can enter public inventory", () => {
    const candidate = { ...OFFERS[0], id: "reviewed-cancer-consultation", providerId: "provider-1", providerName: "Example Provider", treatmentId: "oncology-second-opinion", provenance: "verified" as const,
      verification: { providerIdentityUrl: "https://example.test/provider", credentialUrl: "https://example.test/credentials", offerSourceUrl: "https://example.test/consultation", checkedAt: "2026-11-01", expiresAt: "2027-11-01", reviewer: "Catalogue review team" } };
    const now = Date.parse("2026-11-11T12:00:00Z");
    expect(isPublicOfferEligible(candidate, now)).toBe(true);
    expect(isPublicOfferEligible({ ...candidate, treatmentId: "dental-implants" }, now)).toBe(false);
    expect(isPublicOfferEligible({ ...candidate, provenance: "sample" }, now)).toBe(false);
    expect(isPublicOfferEligible({ ...candidate, verification: { ...candidate.verification, credentialUrl: "http://example.test/credentials" } }, now)).toBe(false);
    expect(isPublicOfferEligible({ ...candidate, verification: { ...candidate.verification, checkedAt: "2026-02-30" } }, now)).toBe(false);
    expect(isPublicOfferEligible(candidate, Date.parse("2027-11-01T00:00:00Z"))).toBe(false);
  });
  it("keeps cancer topic synonyms discoverable without asserting clinical suitability", () => {
    expect(TREATMENTS.find((item) => item.synonyms.includes("radiotherapy"))?.id).toBe("radiation-oncology");
    expect(TREATMENTS.find((item) => item.synonyms.includes("chemotherapy"))?.id).toBe("medical-oncology");
    expect(queryString({ from: "JFK", out: "2027-04-04", q: "cancer" }, { country: "PE", page: null })).toContain("from=JFK");
  });
});
