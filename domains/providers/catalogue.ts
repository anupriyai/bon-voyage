import { COUNTRIES } from "./countries";
export { COUNTRIES } from "./countries";

export interface Specialty { id: string; name: string }
export interface CareProvider { id: string; name: string; countryCode: string; city: string; languages: string[]; provenance: "sample" | "verified" }
export interface Treatment { id: string; slug: string; name: string; specialtyId: string; synonyms: string[]; summary: string }
export const SPECIALTIES: Specialty[] = [{ id: "oncology", name: "Cancer care" }];

const treatment = (id: string, name: string, specialtyId: string, synonyms: string[], summary: string): Treatment => ({ id, slug: id, name, specialtyId, synonyms, summary });
// Navigation taxonomy only. It does not establish suitability, availability or clinical advice.
export const TREATMENTS: Treatment[] = [
  treatment("oncology-second-opinion", "Cancer second opinion", "oncology", ["oncology second opinion", "cancer review", "treatment plan review"], "A second opinion can review a diagnosis or proposed care plan. Availability and next steps require a qualified cancer specialist."),
  treatment("pathology-review", "Cancer pathology review", "oncology", ["biopsy review", "tumour pathology", "tumor pathology"], "A specialist may review existing pathology material as part of confirming a diagnosis."),
  treatment("medical-oncology", "Medical oncology consultation", "oncology", ["chemotherapy", "immunotherapy", "targeted therapy", "hormone therapy"], "Discuss systemic treatment options with a medical oncologist. No treatment is selected through this directory."),
  treatment("radiation-oncology", "Radiation oncology consultation", "oncology", ["radiotherapy", "radiation therapy"], "Discuss whether radiation therapy may have a role in an individual treatment plan."),
  treatment("surgical-oncology", "Cancer surgery consultation", "oncology", ["oncologic surgery", "tumour surgery", "tumor surgery"], "Discuss surgical options with a qualified cancer team; suitability depends on the individual diagnosis."),
  treatment("cancer-genetics", "Cancer genetics consultation", "oncology", ["genetic counseling", "genetic counselling", "hereditary cancer"], "Discuss whether hereditary risk assessment or testing is appropriate with a qualified professional."),
  treatment("supportive-cancer-care", "Supportive cancer care", "oncology", ["palliative care", "symptom management", "oncology rehabilitation"], "Explore supportive care questions to discuss with the treating team at any stage of care."),
];

export interface CareOffer {
  id: string; providerId: string; treatmentId: string; countryCode: string; city: string; providerName: string;
  languages: string[]; accessibility: boolean | null; priceUsd: number | null; inclusions: string[]; exclusions: string[];
  airport: string; latitude: number; longitude: number; transferUsd: number | null; provenance: "sample" | "verified"; description: string;
}

/** A public listing must carry evidence for provider identity, professional credentials,
 * and the precise care offer. Evidence is reviewed before an offer is added below.
 * Price, language and accessibility are only displayed within the recorded scope. */
export interface ListingVerification {
  providerIdentityUrl: string;
  credentialUrl: string;
  offerSourceUrl: string;
  checkedAt: string;
  expiresAt: string;
  reviewer: string;
}
export interface VerifiedCareOffer extends CareOffer {
  provenance: "verified";
  verification: ListingVerification;
}

const httpsSource = (value: string) => {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
};
const dayValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
/** A source record is necessary for publication, but a human still has to check
 * that each source actually supports the name, credentials and offer details. */
export function isPublicOfferEligible(offer: CareOffer & { verification?: ListingVerification }, now = Date.now()): offer is VerifiedCareOffer {
  const proof = offer.verification;
  return offer.provenance === "verified" && !!proof &&
    TREATMENTS.some((item) => item.id === offer.treatmentId) && COUNTRIES.some((item) => item.code === offer.countryCode) &&
    !offer.providerId.startsWith("sample-") && !/fictional|sample/i.test(offer.providerName) &&
    offer.id.trim().length > 0 && offer.providerName.trim().length > 0 && offer.city.trim().length > 0 &&
    (offer.priceUsd === null || (Number.isFinite(offer.priceUsd) && offer.priceUsd >= 0)) &&
    httpsSource(proof.providerIdentityUrl) && httpsSource(proof.credentialUrl) && httpsSource(proof.offerSourceUrl) &&
    proof.reviewer.trim().length > 0 && dayValue(proof.checkedAt) && dayValue(proof.expiresAt) &&
    Date.parse(`${proof.checkedAt}T00:00:00Z`) <= now && Date.parse(`${proof.expiresAt}T00:00:00Z`) > now;
}
// No clinic is currently verified. Adding a candidate requires a reviewed source
// record and a fresh quote or explicit unknown price. Historical examples live separately.
const VERIFIED_LISTING_CANDIDATES: VerifiedCareOffer[] = [];
export const PUBLIC_OFFERS = VERIFIED_LISTING_CANDIDATES.filter((offer) => isPublicOfferEligible(offer));
export const findPublicOffer = (id: string) => PUBLIC_OFFERS.find((item) => item.id === id);
export const findTreatment = (id: string) => TREATMENTS.find((item) => item.id === id || item.slug === id);
