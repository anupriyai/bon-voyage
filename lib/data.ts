// Static catalogue for the prototype. Every hospital, specialist, price and rule below is
// illustrative sample data — nothing here is a real quote, credential or visa rule.

export type DxId = "colon" | "breast" | "prostate" | "lung" | "other";
export type StageId = "1" | "2" | "3" | "4" | "unsure";
export type OriginId = "jordan" | "saudi" | "uae" | "lebanon" | "egypt" | "uk" | "nz" | "other";
export type LangId = "arabic" | "english" | "french" | "turkish" | "german";
export type PriorityId = "experience" | "language" | "cost" | "family" | "speed";
export type BudgetId = "u25" | "25-50" | "50-100" | "o100" | "unsure";
export type InsuranceId = "self" | "partial" | "program" | "unsure";
export type DestId = "home" | "gulf" | "levant" | "turkey" | "europe";
export type TimelineId = "asap" | "month" | "quarter" | "flexible";
export type ContactVia = "email" | "whatsapp" | "phone";
export type HospitalId = "amman" | "cairo" | "istanbul" | "dubai" | "berlin";

export interface Intake {
  forWhom: "self" | "family" | null;
  patientName: string;
  age: string;
  relationship: string;
  managerName: string;
  patientSeesAll: boolean;
  /** Contact details for the person filling in the form, used to follow up on this request. */
  email: string;
  phone: string;
  contactVia: ContactVia | null;
  diagnosis: DxId | null;
  diagnosisOther: string;
  stage: StageId | null;
  origin: OriginId | null;
  originOther: string;
  languages: LangId[];
  priorities: PriorityId[];
  budget: BudgetId | null;
  insurance: InsuranceId | null;
  destinations: DestId[];
  timeline: TimelineId | null;
}

export const DEFAULT_PRIORITIES: PriorityId[] = ["experience", "language", "cost", "family", "speed"];

export function emptyIntake(): Intake {
  return {
    forWhom: null,
    patientName: "",
    age: "",
    relationship: "",
    managerName: "",
    patientSeesAll: true,
    email: "",
    phone: "",
    contactVia: null,
    diagnosis: null,
    diagnosisOther: "",
    stage: null,
    origin: null,
    originOther: "",
    languages: [],
    priorities: [...DEFAULT_PRIORITIES],
    budget: null,
    insurance: null,
    destinations: [],
    timeline: null,
  };
}

/* ---------- Intake choices ---------- */

export const DIAGNOSES: { id: DxId; label: string }[] = [
  { id: "colon", label: "Colon or rectal (bowel)" },
  { id: "breast", label: "Breast" },
  { id: "prostate", label: "Prostate" },
  { id: "lung", label: "Lung" },
  { id: "other", label: "Another type" },
];

export const STAGES: { id: StageId; label: string }[] = [
  { id: "1", label: "Stage 1" },
  { id: "2", label: "Stage 2" },
  { id: "3", label: "Stage 3" },
  { id: "4", label: "Stage 4" },
  { id: "unsure", label: "Not sure" },
];

export const CONTACT_VIA: { id: ContactVia; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Phone call" },
];

export const RELATIONSHIPS = ["Son", "Daughter", "Spouse", "Sibling", "Other family"];

export interface OriginInfo {
  id: OriginId;
  label: string;
  /** Typical home city used for travel estimates. */
  city: string;
  lat: number | null;
  lon: number | null;
  driveKmh: number;
  /** Hospital country this origin shares, so the trip is a drive with no visa. */
  country: string | null;
  /** Hospitals that count as "close to home". */
  nearHome: HospitalId[];
  /** Rough cost of the same pre-treatment scan at a local hospital, USD. */
  scanAtHome: number;
}

export const ORIGINS: OriginInfo[] = [
  { id: "jordan", label: "Jordan", city: "Irbid", lat: 32.55, lon: 35.85, driveKmh: 55, country: "jordan", nearHome: ["amman"], scanAtHome: 240 },
  { id: "saudi", label: "Saudi Arabia", city: "Riyadh", lat: 24.71, lon: 46.68, driveKmh: 90, country: null, nearHome: ["dubai"], scanAtHome: 480 },
  { id: "uae", label: "UAE", city: "Abu Dhabi", lat: 24.45, lon: 54.38, driveKmh: 100, country: "uae", nearHome: ["dubai"], scanAtHome: 520 },
  { id: "lebanon", label: "Lebanon", city: "Beirut", lat: 33.89, lon: 35.5, driveKmh: 60, country: null, nearHome: ["amman"], scanAtHome: 300 },
  { id: "egypt", label: "Egypt", city: "Alexandria", lat: 31.2, lon: 29.92, driveKmh: 80, country: "egypt", nearHome: ["cairo"], scanAtHome: 180 },
  { id: "uk", label: "United Kingdom", city: "London", lat: 51.5, lon: -0.12, driveKmh: 80, country: null, nearHome: [], scanAtHome: 550 },
  { id: "nz", label: "New Zealand", city: "Auckland", lat: -36.85, lon: 174.76, driveKmh: 80, country: null, nearHome: [], scanAtHome: 900 },
  { id: "other", label: "Another country", city: "your home city", lat: null, lon: null, driveKmh: 80, country: null, nearHome: [], scanAtHome: 450 },
];

export const ORIGIN_BY_ID = Object.fromEntries(ORIGINS.map((o) => [o.id, o])) as Record<OriginId, OriginInfo>;

export const LANGUAGES: { id: LangId; label: string }[] = [
  { id: "arabic", label: "Arabic" },
  { id: "english", label: "English" },
  { id: "french", label: "French" },
  { id: "turkish", label: "Turkish" },
  { id: "german", label: "German" },
];

export const LANG_LABEL = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.label])) as Record<LangId, string>;

export const PRIORITIES: { id: PriorityId; label: string; desc: string }[] = [
  { id: "experience", label: "Specialist experience", desc: "Years in practice and number of similar cases treated" },
  { id: "language", label: "Language and culture", desc: "Speaks your language and respects your faith and customs" },
  { id: "cost", label: "Total cost", desc: "The all-in estimate, including stay and travel" },
  { id: "family", label: "Close to family", desc: "How easily relatives can visit and help" },
  { id: "speed", label: "How soon treatment starts", desc: "Time until the first appointment" },
];

export const PRIORITY_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p])) as Record<
  PriorityId,
  (typeof PRIORITIES)[number]
>;

export const BUDGETS: { id: BudgetId; label: string; max: number | null }[] = [
  { id: "u25", label: "Under $25,000", max: 25000 },
  { id: "25-50", label: "$25,000–50,000", max: 50000 },
  { id: "50-100", label: "$50,000–100,000", max: 100000 },
  { id: "o100", label: "Over $100,000", max: Infinity },
  { id: "unsure", label: "Not sure yet", max: null },
];

export const INSURANCE: { id: InsuranceId; label: string }[] = [
  { id: "self", label: "We will pay ourselves" },
  { id: "partial", label: "Insurance may cover part" },
  { id: "program", label: "Government or employer program" },
  { id: "unsure", label: "Not sure" },
];

export const DESTINATIONS: { id: DestId; label: string }[] = [
  { id: "home", label: "Close to home" },
  { id: "gulf", label: "Gulf (Dubai)" },
  { id: "levant", label: "Jordan and Egypt (Amman, Cairo)" },
  { id: "turkey", label: "Turkey (Istanbul)" },
  { id: "europe", label: "Europe (Berlin)" },
];

export const TIMELINES: { id: TimelineId; label: string }[] = [
  { id: "asap", label: "As soon as possible" },
  { id: "month", label: "Within 1 month" },
  { id: "quarter", label: "1–3 months" },
  { id: "flexible", label: "Flexible" },
];

/* ---------- Per-diagnosis data ---------- */

export const DX_INFO: Record<
  DxId,
  { name: string; surgeon: string; head: string; oncologist: string; scanTitle: string; surgery: string }
> = {
  colon: {
    name: "colon cancer",
    surgeon: "Colorectal cancer surgeon",
    head: "Head of Colorectal Surgery",
    oncologist: "Medical oncologist, bowel cancers",
    scanTitle: "Extra pelvic MRI",
    surgery: "Surgery (planned)",
  },
  breast: {
    name: "breast cancer",
    surgeon: "Breast cancer surgeon",
    head: "Head of Breast Surgery",
    oncologist: "Medical oncologist, breast cancer",
    scanTitle: "Breast MRI before surgery",
    surgery: "Surgery (planned)",
  },
  prostate: {
    name: "prostate cancer",
    surgeon: "Urologic cancer surgeon",
    head: "Head of Urologic Oncology",
    oncologist: "Radiation oncologist, prostate cancer",
    scanTitle: "Prostate MRI before treatment",
    surgery: "Treatment (planned)",
  },
  lung: {
    name: "lung cancer",
    surgeon: "Thoracic cancer surgeon",
    head: "Head of Thoracic Surgery",
    oncologist: "Medical oncologist, lung cancer",
    scanTitle: "Fresh chest CT scan",
    surgery: "Treatment (planned)",
  },
  other: {
    name: "cancer",
    surgeon: "Cancer surgeon",
    head: "Head of Surgical Oncology",
    oncologist: "Medical oncologist",
    scanTitle: "Updated imaging scan",
    surgery: "Treatment (planned)",
  },
};

export const DX_COST: Record<DxId, number> = { colon: 1, breast: 1.05, prostate: 0.9, lung: 1.2, other: 1 };
export const DX_VOLUME: Record<DxId, number> = { colon: 1, breast: 1.4, prostate: 1.1, lung: 0.8, other: 0.6 };
export const STAGE_COST: Record<StageId, number> = { "1": 0.7, "2": 0.85, "3": 1, "4": 1.25, unsure: 1 };
export const STAGE_STAY: Record<StageId, number> = { "1": 0.8, "2": 0.9, "3": 1, "4": 1.15, unsure: 1 };

/* ---------- Hospitals ---------- */

export interface Hospital {
  id: HospitalId;
  city: string;
  country: string;
  name: string;
  region: DestId;
  lat: number;
  lon: number;
  specialist: { name: string; years: number; cases: number };
  /** Languages staff speak directly. */
  languages: LangId[];
  /** Languages offered through an interpreter. */
  interpreter: LangId[];
  culture: number;
  cultureNote: string;
  baseTreatment: number;
  baseDiagnostics: number;
  nightly: number;
  baseStay: number;
  supportBase: number;
  low: number;
  high: number;
  apptDays: number;
  visa: { free: OriginId[]; kind: string; fee: number; days: number };
  /** Cost of the extra scan the team may request, USD. */
  scanCost: number;
  couldChange: string;
}

export const HOSPITALS: Hospital[] = [
  {
    id: "amman",
    city: "Amman",
    country: "jordan",
    name: "Levant Comprehensive Cancer Center",
    region: "levant",
    lat: 31.95,
    lon: 35.93,
    specialist: { name: "Dr. Rania Haddadin", years: 18, cases: 210 },
    languages: ["arabic", "english"],
    interpreter: [],
    culture: 1,
    cultureNote: "Prayer rooms, halal meals and Arabic-speaking nursing staff.",
    baseTreatment: 16900,
    baseDiagnostics: 3600,
    nightly: 33,
    baseStay: 18,
    supportBase: 400,
    low: 0.7,
    high: 1.385,
    apptDays: 6,
    visa: { free: ["jordan", "saudi", "uae", "lebanon", "egypt", "uk", "nz"], kind: "Visa on arrival", fee: 60, days: 2 },
    scanCost: 680,
    couldChange:
      "Could rise if the procedure is more complex than the scans suggest, or if a longer hospital stay is needed to manage other health conditions.",
  },
  {
    id: "cairo",
    city: "Cairo",
    country: "egypt",
    name: "Nile Specialist Oncology Hospital",
    region: "levant",
    lat: 30.04,
    lon: 31.24,
    specialist: { name: "Dr. Mona El-Sayed", years: 15, cases: 340 },
    languages: ["arabic", "english", "french"],
    interpreter: [],
    culture: 0.95,
    cultureNote: "Prayer rooms, halal meals and a large Arabic-speaking team.",
    baseTreatment: 12500,
    baseDiagnostics: 2400,
    nightly: 70,
    baseStay: 17,
    supportBase: 600,
    low: 0.72,
    high: 1.4,
    apptDays: 8,
    visa: { free: ["egypt", "jordan", "saudi", "uae", "lebanon"], kind: "Visa on arrival", fee: 40, days: 1 },
    scanCost: 420,
    couldChange:
      "The quote is in US dollars, but local costs such as accommodation and transport move with the Egyptian pound, often by 10–15%. Private rooms beyond the package are billed per night.",
  },
  {
    id: "istanbul",
    city: "Istanbul",
    country: "turkey",
    name: "Bosphorus Oncology Institute",
    region: "turkey",
    lat: 41.01,
    lon: 28.98,
    specialist: { name: "Dr. Selin Karaca", years: 14, cases: 520 },
    languages: ["turkish", "english"],
    interpreter: ["arabic", "german"],
    culture: 0.7,
    cultureNote: "Arabic interpreters on every ward and halal meals; the team is not Arabic-speaking.",
    baseTreatment: 25000,
    baseDiagnostics: 4200,
    nightly: 190,
    baseStay: 20,
    supportBase: 1400,
    low: 0.78,
    high: 1.33,
    apptDays: 10,
    visa: { free: ["jordan", "saudi", "uae", "uk", "nz"], kind: "e-Visa", fee: 60, days: 2 },
    scanCost: 740,
    couldChange:
      "The quote is in US dollars and fixed for 60 days. Each extra night in hospital costs about $650.",
  },
  {
    id: "dubai",
    city: "Dubai",
    country: "uae",
    name: "Gulf Specialist Cancer Hospital",
    region: "gulf",
    lat: 25.2,
    lon: 55.27,
    specialist: { name: "Dr. Farah Nassar", years: 16, cases: 300 },
    languages: ["arabic", "english"],
    interpreter: ["french"],
    culture: 0.9,
    cultureNote: "Prayer rooms, halal meals and Arabic-speaking staff across departments.",
    baseTreatment: 44000,
    baseDiagnostics: 6500,
    nightly: 310,
    baseStay: 16,
    supportBase: 2000,
    low: 0.81,
    high: 1.3,
    apptDays: 7,
    visa: { free: ["uae", "saudi", "uk", "nz"], kind: "e-Visa", fee: 120, days: 5 },
    scanCost: 1150,
    couldChange:
      "Rents in Dubai rise in winter. Medicines given in hospital are billed separately from the treatment package.",
  },
  {
    id: "berlin",
    city: "Berlin",
    country: "germany",
    name: "Spree University Hospital",
    region: "europe",
    lat: 52.52,
    lon: 13.4,
    specialist: { name: "Prof. Dr. Henrike Albers", years: 25, cases: 900 },
    languages: ["german", "english"],
    interpreter: ["arabic", "turkish"],
    culture: 0.45,
    cultureNote: "Arabic interpreters on request and a multi-faith chaplaincy; halal meals need to be ordered ahead.",
    baseTreatment: 52000,
    baseDiagnostics: 6000,
    nightly: 180,
    baseStay: 22,
    supportBase: 3600,
    low: 0.77,
    high: 1.31,
    apptDays: 8,
    visa: { free: ["uk", "nz", "uae"], kind: "Medical visa", fee: 95, days: 17 },
    scanCost: 1400,
    couldChange:
      "German hospitals usually repeat scans older than 4 weeks ($680–1,400). Changes in the euro exchange rate can move the total by a few percent.",
  },
];

export const HOSPITAL_BY_ID = Object.fromEntries(HOSPITALS.map((h) => [h.id, h])) as Record<HospitalId, Hospital>;

/* ---------- Second-opinion panel ---------- */

export const PANEL: {
  initials: string;
  name: string;
  role: "surgeon" | "head" | "oncologist";
  org: string;
  years: number;
  cases: number;
  independent?: boolean;
}[] = [
  { initials: "RH", name: "Dr. Rania Haddadin", role: "surgeon", org: "Levant Comprehensive Cancer Center, Amman", years: 18, cases: 210 },
  { initials: "HA", name: "Prof. Dr. Henrike Albers", role: "head", org: "Spree University Hospital, Berlin", years: 25, cases: 900 },
  { initials: "KS", name: "Dr. Kamal Shaheen", role: "oncologist", org: "Bosphorus Oncology Institute, Istanbul", years: 16, cases: 0, independent: true },
];

export const SECOND_OPINION_FEE = 450;
export const COORDINATION_FEE = 1950;

/* ---------- Medical records checklist ---------- */

export interface RecordItem {
  id: string;
  group: string;
  title: string;
  hint?: string;
  optional?: boolean;
  physical?: boolean;
}

const G_IMAGING = "Scans and imaging";
const G_PATH = "Pathology (biopsy results)";
const G_BLOOD = "Blood tests";
const G_HISTORY = "Medical history";

const COMMON_HISTORY = [
  { key: "letter", title: "Doctor's summary letter", hint: "A short letter from the treating doctor, in any language." },
  { key: "meds", title: "Current medication list", hint: "Photo of the boxes or the prescription is fine." },
  { key: "conditions", title: "Other health conditions and allergies", hint: "For example diabetes, heart conditions or drug allergies." },
];

type RawItem = { key: string; group?: string; title: string; hint?: string; optional?: boolean; physical?: boolean };

export function recordsFor(dx: DxId | null): RecordItem[] {
  const d: DxId = dx ?? "other";
  const slides: RawItem = {
    key: "slides",
    group: G_PATH,
    title: "Pathology slides and tissue blocks",
    hint: "Physical samples. We arrange a medical courier from the lab.",
    physical: true,
  };
  const blood: RawItem = { key: "blood", group: G_BLOOD, title: "Blood count, kidney and liver tests" };
  const sets: Record<DxId, RawItem[]> = {
    colon: [
      { key: "ct", group: G_IMAGING, title: "CT scan — chest, abdomen and pelvis" },
      { key: "scope", group: G_IMAGING, title: "Colonoscopy report with photos" },
      { key: "pet", group: G_IMAGING, title: "PET-CT scan", optional: true, hint: "Only some hospitals ask for it. The panel will say if it is needed." },
      { key: "biopsy", group: G_PATH, title: "Biopsy pathology report" },
      slides,
      { key: "mmr", group: G_PATH, title: "MMR / MSI test on the tumor", hint: "Done on the existing biopsy — no new procedure. Helps choose chemotherapy." },
      blood,
      { key: "cea", group: G_BLOOD, title: "CEA tumor marker" },
    ],
    breast: [
      { key: "mammo", group: G_IMAGING, title: "Mammogram and breast ultrasound" },
      { key: "mri", group: G_IMAGING, title: "Breast MRI", optional: true },
      { key: "staging", group: G_IMAGING, title: "Staging scans (CT or PET-CT)", hint: "Usually only needed for stage 2 and above." },
      { key: "biopsy", group: G_PATH, title: "Biopsy pathology report" },
      { key: "receptors", group: G_PATH, title: "Hormone receptor and HER2 results", hint: "Done on the existing biopsy — no new procedure." },
      slides,
      { key: "genetic", group: G_PATH, title: "Genetic test (BRCA)", optional: true },
      blood,
    ],
    prostate: [
      { key: "mri", group: G_IMAGING, title: "Prostate MRI" },
      { key: "bone", group: G_IMAGING, title: "Bone scan or PSMA PET-CT", optional: true, hint: "Asked for in higher-risk cases. The panel will say if it is needed." },
      { key: "biopsy", group: G_PATH, title: "Biopsy report with Gleason score" },
      slides,
      { key: "psa", group: G_BLOOD, title: "PSA results over time", hint: "Every PSA result you have, with dates." },
      blood,
    ],
    lung: [
      { key: "ct", group: G_IMAGING, title: "CT scan of the chest" },
      { key: "pet", group: G_IMAGING, title: "PET-CT scan" },
      { key: "brain", group: G_IMAGING, title: "Brain MRI", optional: true },
      { key: "biopsy", group: G_PATH, title: "Biopsy pathology report" },
      { key: "molecular", group: G_PATH, title: "Molecular tests (EGFR, ALK, PD-L1)", hint: "Done on the existing biopsy — no new procedure." },
      slides,
      { key: "lungfn", group: G_BLOOD, title: "Lung function test" },
      blood,
    ],
    other: [
      { key: "scans", group: G_IMAGING, title: "Latest scans (CT, MRI or PET-CT)" },
      { key: "reports", group: G_IMAGING, title: "Written scan reports" },
      { key: "biopsy", group: G_PATH, title: "Biopsy or pathology report" },
      { ...slides, optional: true },
      blood,
    ],
  };
  const order = [G_IMAGING, G_PATH, G_BLOOD, G_HISTORY];
  const raw: RawItem[] = [
    ...sets[d],
    ...COMMON_HISTORY.map((h) => ({ ...h, group: G_HISTORY })),
  ];
  return raw
    .map((r) => ({
      id: `${d}.${r.key}`,
      group: r.group ?? G_HISTORY,
      title: r.title,
      hint: r.hint,
      optional: r.optional,
      physical: r.physical,
    }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

export const COORDINATOR = {
  name: "Hala Mansour",
  initials: "HM",
  blurb: "Your care coordinator · Arabic and English · replies within 2 hours, 8am–8pm",
};
