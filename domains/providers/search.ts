import { COUNTRIES } from "./countries";
import { PUBLIC_OFFERS, SPECIALTIES, TREATMENTS, type CareOffer } from "./catalogue";

export type SearchValues = Record<string, string | string[] | undefined>;
export interface CareSearch { q: string; treatment: string; country: string; specialty: string; min: number | null; max: number | null; language: string; accessible: boolean; sort: "listed" | "price" | "destination"; page: number; compare: string[] }
export const PAGE_SIZE = 8;
export const normalise = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const amount = (value: string) => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function parseCareSearch(values: SearchValues): CareSearch {
  const sort = first(values.sort);
  const ids = first(values.compare).split(",").filter((id) => PUBLIC_OFFERS.some((offer) => offer.id === id));
  return { q: first(values.q).slice(0, 160).trim(), treatment: first(values.treatment), country: first(values.country).toUpperCase(), specialty: first(values.specialty),
    min: amount(first(values.min)), max: amount(first(values.max)), language: first(values.language), accessible: first(values.accessible) === "1",
    sort: sort === "destination" || sort === "price" ? sort : "listed", page: Math.max(1, Math.min(10000, Math.floor(Number(first(values.page))) || 1)), compare: [...new Set(ids)].slice(0, 3) };
}

export function searchCare(search: CareSearch, offers: CareOffer[] = PUBLIC_OFFERS) {
  const tokens = normalise(search.q).split(/\s+/).filter(Boolean);
  const results = offers.filter((offer) => {
    const treatment = TREATMENTS.find((item) => item.id === offer.treatmentId);
    const country = COUNTRIES.find((item) => item.code === offer.countryCode);
    const specialty = SPECIALTIES.find((item) => item.id === treatment?.specialtyId);
    const haystack = normalise([offer.city, country?.name, offer.countryCode, treatment?.name, treatment?.synonyms.join(" "), specialty?.name].join(" "));
    return tokens.every((token) => haystack.includes(token)) && (!search.treatment || offer.treatmentId === search.treatment)
      && (!search.country || offer.countryCode === search.country) && (!search.specialty || treatment?.specialtyId === search.specialty)
      && (!search.language || offer.languages.includes(search.language)) && (!search.accessible || offer.accessibility === true)
      && (search.min === null || (offer.priceUsd !== null && offer.priceUsd >= search.min)) && (search.max === null || (offer.priceUsd !== null && offer.priceUsd <= search.max));
  });
  if (search.sort !== "listed") results.sort((a, b) => search.sort === "destination" ? (COUNTRIES.find((item) => item.code === a.countryCode)?.name ?? "").localeCompare(COUNTRIES.find((item) => item.code === b.countryCode)?.name ?? "") || a.city.localeCompare(b.city) || a.id.localeCompare(b.id)
    : (a.priceUsd ?? Infinity) - (b.priceUsd ?? Infinity) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(search.page, pages);
  return { total: results.length, pages, page, offers: results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export function queryString(values: SearchValues, updates: Record<string, string | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) { const entry = first(value); if (entry) params.set(key, entry); }
  for (const [key, value] of Object.entries(updates)) { if (value) params.set(key, value); else params.delete(key); }
  return params.toString();
}
export function travelQuery(values: SearchValues) {
  const params = new URLSearchParams();
  for (const key of ["from", "out", "back", "travellers"]) { const value = first(values[key]); if (value) params.set(key, value); }
  return params.toString();
}
