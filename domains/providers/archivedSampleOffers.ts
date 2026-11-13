// Historical fictional fixtures for private archived plans and isolated regression tests.
// Do not import this module from public pages or browser-safe catalogue exports.
import { PUBLIC_OFFERS, type CareOffer, type CareProvider } from "./catalogue";

interface Place { countryCode: string; city: string; airport: string; latitude: number; longitude: number; languages: string[]; transferUsd: number | null }
const PLACES: Record<string, Place> = {
  lima: { countryCode: "PE", city: "Lima", airport: "LIM", latitude: -12.05, longitude: -77.04, languages: ["English", "Spanish"], transferUsd: 120 },
  guadalajara: { countryCode: "MX", city: "Guadalajara", airport: "GDL", latitude: 20.67, longitude: -103.35, languages: ["English", "Spanish"], transferUsd: 140 },
  lisbon: { countryCode: "PT", city: "Lisbon", airport: "LIS", latitude: 38.72, longitude: -9.14, languages: ["English", "Portuguese"], transferUsd: 220 },
  bangkok: { countryCode: "TH", city: "Bangkok", airport: "BKK", latitude: 13.76, longitude: 100.5, languages: ["English", "Thai"], transferUsd: 60 },
  capeTown: { countryCode: "ZA", city: "Cape Town", airport: "CPT", latitude: -33.92, longitude: 18.42, languages: ["English", "Afrikaans"], transferUsd: 80 },
  goldCoast: { countryCode: "AU", city: "Gold Coast", airport: "OOL", latitude: -28.02, longitude: 153.4, languages: ["English"], transferUsd: 90 },
  istanbul: { countryCode: "TR", city: "Istanbul", airport: "IST", latitude: 41.01, longitude: 28.97, languages: ["English", "Turkish"], transferUsd: 100 },
  seoul: { countryCode: "KR", city: "Seoul", airport: "ICN", latitude: 37.57, longitude: 126.98, languages: ["English", "Korean"], transferUsd: 120 },
  bogota: { countryCode: "CO", city: "Bogotá", airport: "BOG", latitude: 4.71, longitude: -74.07, languages: ["English", "Spanish"], transferUsd: null },
  delhi: { countryCode: "IN", city: "New Delhi", airport: "DEL", latitude: 28.61, longitude: 77.21, languages: ["English", "Hindi"], transferUsd: 70 },
  kualaLumpur: { countryCode: "MY", city: "Kuala Lumpur", airport: "KUL", latitude: 3.14, longitude: 101.69, languages: ["English", "Malay"], transferUsd: 75 },
};

function offer(id: string, place: keyof typeof PLACES, treatmentId: string, providerName: string, priceUsd: number | null, accessibility: boolean | null, inclusions: string[]): CareOffer {
  return { id, ...PLACES[place], providerId: `sample-${providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, treatmentId, providerName: `${providerName} · fictional provider`, priceUsd, accessibility,
    inclusions, exclusions: ["Flights and accommodation", "Additional tests or treatment", "Personal expenses and insurance"], provenance: "sample",
    description: "A fictional care option created to demonstrate how comparing treatment and travel can work. This is not a verified provider, confirmed appointment or medical recommendation." };
}
export const OFFERS: CareOffer[] = [
  offer("lima-dental-implants", "lima", "dental-implants", "Miraflores Dental Studio", 3900, true, ["Initial dental assessment", "One implant and crown", "Planned follow-up visit"]),
  offer("guadalajara-dental-implants", "guadalajara", "dental-implants", "Providencia Care Centre", 3200, null, ["Initial dental assessment", "One implant and crown", "Planned follow-up visit"]),
  offer("istanbul-dental-implants", "istanbul", "dental-implants", "Bosphorus Dental House", 2800, true, ["Initial dental assessment", "One implant and crown", "Planned follow-up visit"]),
  offer("lima-dental-crowns", "lima", "dental-crowns", "Miraflores Dental Studio", 850, true, ["Consultation", "One dental crown", "Fitting visit"]),
  offer("bogota-veneers", "bogota", "veneers", "Andes Dental Atelier", 2600, null, ["Smile consultation", "Four veneers", "Fitting appointment"]),
  offer("guadalajara-knee-arthroscopy", "guadalajara", "knee-arthroscopy", "Providencia Care Centre", 7200, true, ["Specialist consultation", "Illustrative procedure estimate", "One follow-up appointment"]),
  offer("lisbon-hip-replacement", "lisbon", "hip-replacement", "Saldanha Orthopaedic Centre", 13200, true, ["Specialist consultation", "Illustrative procedure estimate", "Initial physiotherapy assessment"]),
  offer("delhi-knee-replacement", "delhi", "knee-replacement", "Lotus Joint Institute", 8900, true, ["Specialist consultation", "Illustrative procedure estimate", "Discharge planning"]),
  offer("cape-town-lasik", "capeTown", "lasik", "Green Point Vision Centre", 2400, null, ["Eye assessment", "Illustrative bilateral procedure", "Scheduled review"]),
  offer("bangkok-lasik", "bangkok", "lasik", "Sukhumvit Vision House", 2100, true, ["Eye assessment", "Illustrative bilateral procedure", "Scheduled review"]),
  offer("kuala-lumpur-cataract", "kualaLumpur", "cataract-surgery", "Orchid Eye Centre", 1800, true, ["Specialist assessment", "Single-eye estimate", "Scheduled review"]),
  offer("gold-coast-ivf", "goldCoast", "ivf", "Coastal Fertility Rooms", 10200, true, ["Initial consultation", "Illustrative single-cycle clinic fees", "Planning review"]),
  offer("bangkok-ivf", "bangkok", "ivf", "Sukhumvit Family Centre", 6800, null, ["Initial consultation", "Illustrative single-cycle clinic fees", "Planning review"]),
  offer("bangkok-screening", "bangkok", "health-screening", "Sukhumvit Health House", 1250, true, ["Consultation", "Illustrative screening package", "Results review"]),
  offer("seoul-screening", "seoul", "health-screening", "Han River Wellness Centre", 1600, true, ["Consultation", "Illustrative screening package", "Results review"]),
  offer("kuala-lumpur-screening", "kualaLumpur", "health-screening", "Orchid Health Centre", 900, true, ["Consultation", "Illustrative screening package", "Results review"]),
  offer("istanbul-hair-transplant", "istanbul", "hair-transplant", "Bosphorus Restoration Clinic", 3300, null, ["Specialist assessment", "Illustrative restoration estimate", "Scheduled review"]),
  offer("seoul-rhinoplasty", "seoul", "rhinoplasty", "Han River Specialist Rooms", 5400, true, ["Specialist consultation", "Illustrative procedure estimate", "Scheduled review"]),
  offer("bogota-breast-consultation", "bogota", "breast-surgery", "Andes Specialist Rooms", 180, null, ["Specialist consultation", "Written planning summary"]),
  offer("delhi-cardiac-screening", "delhi", "cardiac-screening", "Lotus Heart Centre", 650, true, ["Cardiology consultation", "Illustrative diagnostic package", "Results review"]),
  offer("lisbon-cardiology", "lisbon", "cardiology-consultation", "Saldanha Specialist Rooms", 240, true, ["Cardiology consultation", "Written planning summary"]),
  offer("delhi-oncology-review", "delhi", "oncology-second-opinion", "Lotus Specialist Review", null, null, ["Specialist record review", "Remote consultation", "Written second opinion"]),
  offer("istanbul-bariatric", "istanbul", "bariatric-consultation", "Bosphorus Specialist Rooms", 220, true, ["Specialist consultation", "Written planning summary"]),
  offer("cape-town-physio", "capeTown", "physiotherapy", "Green Point Recovery Studio", 420, true, ["Initial assessment", "Four physiotherapy sessions", "Home exercise planning"]),
  offer("seoul-dermatology", "seoul", "dermatology-consultation", "Han River Skin Rooms", 160, true, ["Dermatology consultation", "Written planning summary"]),
  offer("kuala-lumpur-neurology", "kualaLumpur", "neurology-second-opinion", "Orchid Specialist Review", null, null, ["Specialist record review", "Consultation", "Written second opinion"]),
  offer("bangkok-urology", "bangkok", "urology-consultation", "Sukhumvit Specialist Rooms", 180, true, ["Urology consultation", "Written planning summary"]),
  offer("kuala-lumpur-gastroenterology", "kualaLumpur", "gastroenterology-consultation", "Orchid Specialist Review", 190, true, ["Specialist consultation", "Written planning summary"]),
];
/** Historical sample provider identities are kept for archived records only. */
export const PROVIDERS: CareProvider[] = [...new Map(OFFERS.map((item) => [item.providerId, { id: item.providerId, name: item.providerName, countryCode: item.countryCode, city: item.city, languages: item.languages, provenance: item.provenance }])).values()];
export const findOffer = (id: string) => PUBLIC_OFFERS.find((item) => item.id === id) ?? OFFERS.find((item) => item.id === id);
