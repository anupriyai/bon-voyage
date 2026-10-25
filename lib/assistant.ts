// The scripted assistant. Every function here runs locally with no network, so the demo always works.
// The API route (app/api/assistant/route.ts) can replace `extractStory` and `classifyChange` with Claude
// when ANTHROPIC_API_KEY is set; the shapes below are the contract both sides share.

import {
  HOSPITALS,
  ORIGIN_BY_ID,
  type BudgetId,
  type DxId,
  type HospitalId,
  type InsuranceId,
  type LangId,
  type OriginId,
  type StageId,
  type TimelineId,
} from "./data";
import type { OptionResult, Plan } from "./engine";
import { round10 } from "./format";

/* =====================================================================
   Story extraction
   ===================================================================== */

/** A detail the assistant picked out, with the words it came from. */
export interface Hit<T> {
  v: T;
  q: string;
}

export interface Found {
  rel?: Hit<string>;
  self?: Hit<true>;
  name?: Hit<string>;
  age?: Hit<string>;
  dx?: Hit<DxId>;
  stage?: Hit<StageId>;
  origin?: Hit<OriginId> & { city: string; label: string };
  langs?: Hit<LangId[]>;
  time?: Hit<TimelineId>;
  budget?: Hit<BudgetId>;
  pay?: Hit<InsuranceId>;
  mgr?: Hit<string> & { rel: string };
  dest?: Hit<HospitalId[]>;
}

export const SAMPLE_STORY =
  "My father Yousef Al-Masri is 68 and was diagnosed with stage 3 colon cancer last month. We live in Irbid, Jordan, and he only speaks Arabic. We would like him to start treatment within a month if possible. We can pay around $40,000 ourselves. I’m his son, Omar.";

export const STARTERS = [
  "My father has stage 3 colon cancer",
  "I need a second opinion on breast cancer",
  "We’re comparing hospitals abroad",
];

export const PLACEHOLDERS = [
  "e.g. My mother has stage 2 breast cancer and lives in Riyadh…",
  "e.g. I was diagnosed with prostate cancer and want a second opinion…",
  "e.g. My husband, 61, has lung cancer. We live in Beirut and speak Arabic and French…",
  "e.g. We’re comparing hospitals in Amman, Istanbul and Berlin…",
];

const ORIGIN_KEYS: Record<Exclude<OriginId, "other">, string[]> = {
  jordan: ["irbid", "amman", "zarqa", "jordan"],
  saudi: ["riyadh", "jeddah", "dammam", "saudi arabia", "saudi"],
  uae: ["abu dhabi", "sharjah", "uae", "emirates"],
  lebanon: ["beirut", "tripoli", "lebanon"],
  egypt: ["alexandria", "giza", "egypt"],
  uk: ["london", "manchester", "birmingham", "united kingdom", "england", "britain", "uk"],
  nz: ["auckland", "wellington", "new zealand"],
};
const COUNTRY_WORDS = new Set([
  "jordan", "saudi arabia", "saudi", "uae", "emirates", "lebanon", "egypt",
  "united kingdom", "england", "britain", "uk", "new zealand",
]);
const LANG_IDS: LangId[] = ["arabic", "english", "french", "turkish", "german"];
const RELATIONS =
  "father|dad|mother|mum|mom|husband|wife|son|daughter|brother|sister|uncle|aunt|grandfather|grandmother";

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Prototype heuristics: pick out the case details a coordinator needs from free text. */
export function extractStory(t: string): Found {
  const r: Found = {};
  const low = t.toLowerCase();
  let m: RegExpMatchArray | null;

  m = t.match(new RegExp(`\\bmy\\s+(${RELATIONS})\\b`, "i"));
  if (m) r.rel = { v: m[1].toLowerCase(), q: m[0] };
  else {
    m = t.match(/\b(I was diagnosed|I've been diagnosed|I have been diagnosed|for myself|I have)\b/i);
    if (m) r.self = { v: true, q: m[0] };
  }

  m =
    t.match(new RegExp(`\\b(?:${RELATIONS}),?\\s+([A-Z][a-z]+(?:\\s+[A-Z][A-Za-z\\-]+)?)`)) ||
    t.match(/\bnamed\s+([A-Z][a-z]+(?:\s+[A-Z][A-Za-z-]+)?)/);
  if (m) r.name = { v: m[1], q: m[0] };

  m = t.match(/\b(\d{1,3})\s*(?:-?\s*years?[- ]old|yrs? old|y\/o)/i) || t.match(/\b(?:is|aged?)\s+(\d{2})\b/i);
  if (m && +m[1] > 0 && +m[1] < 121) r.age = { v: m[1], q: m[0] };

  m = t.match(/\b(colon|bowel|rectal|colorectal|breast|prostate|lung)\b(\s+cancer)?/i);
  if (m) {
    const w = m[1].toLowerCase();
    r.dx = { v: (["colon", "bowel", "rectal", "colorectal"].includes(w) ? "colon" : w) as DxId, q: m[0] };
  } else {
    m = t.match(/\b(cancer|tumou?r|oncolog\w*)\b/i);
    if (m) r.dx = { v: "other", q: m[0] };
  }

  m = t.match(/\bstage\s*(4|3|2|1|iv|iii|ii|i|four|three|two|one)\b/i);
  if (m) {
    const map: Record<string, StageId> = { "1": "1", "2": "2", "3": "3", "4": "4", i: "1", ii: "2", iii: "3", iv: "4", one: "1", two: "2", three: "3", four: "4" };
    r.stage = { v: map[m[1].toLowerCase()], q: m[0] };
  }

  const live = t.match(/\b(?:live|living|based|are|is|from)\s+(?:in|from)\s+([A-Z][A-Za-z]+(?:[ ,]+[A-Z][A-Za-z]+)?)/);
  const scan = live ? live[1].toLowerCase() : low;
  for (const [id, keys] of Object.entries(ORIGIN_KEYS) as [OriginId, string[]][]) {
    const k = keys.find((key) => new RegExp(`\\b${key}\\b`).test(scan));
    if (!k) continue;
    const info = ORIGIN_BY_ID[id];
    const city = COUNTRY_WORDS.has(k) ? null : titleCase(k);
    r.origin = { v: id, label: city ? `${city}, ${info.label}` : info.label, city: city ?? info.city, q: live ? live[0] : k };
    break;
  }

  const langs = LANG_IDS.filter((l) => low.includes(l));
  if (langs.length) {
    const q = t.match(new RegExp(`[^.]{0,18}${langs[0]}`, "i"));
    // Start the quote on a whole word.
    const quote = q ? (q.index && /\S/.test(t[q.index - 1]) ? q[0].replace(/^\S*\s/, "") : q[0]) : langs[0];
    r.langs = { v: langs, q: quote.trim() };
  }

  if ((m = t.match(/\b(as soon as possible|asap|urgent(?:ly)?|right away)\b/i))) r.time = { v: "asap", q: m[0] };
  else if ((m = t.match(/\b(within (?:a|one|1) month|next month|this month|in a month)\b/i))) r.time = { v: "month", q: m[0] };
  else if ((m = t.match(/\b(\d\s*(?:-|to)\s*\d\s*months|few months|couple of months)\b/i))) r.time = { v: "quarter", q: m[0] };
  else if ((m = t.match(/\b(flexible|no rush)\b/i))) r.time = { v: "flexible", q: m[0] };

  const amounts: { n: number; q: string }[] = [];
  const re = /(?:us\s?\$|\$|usd\s?)\s?(\d[\d,.]*)\s*(k|thousand)?|(\d[\d,.]*)\s*(k|thousand)?\s*(?:usd|dollars)/gi;
  let a: RegExpExecArray | null;
  while ((a = re.exec(t))) {
    const num = parseFloat((a[1] || a[3]).replace(/,/g, ""));
    if (!isNaN(num)) amounts.push({ n: a[2] || a[4] ? num * 1000 : num, q: a[0] });
  }
  if (amounts.length) {
    const top = amounts.reduce((x, y) => (y.n > x.n ? y : x));
    r.budget = { v: top.n < 25000 ? "u25" : top.n <= 50000 ? "25-50" : top.n <= 100000 ? "50-100" : "o100", q: top.q };
  }

  if ((m = t.match(/\b(pay\b[^.]{0,30}?\b(?:ourselves|myself)|self[- ]pay|out of pocket)\b/i))) r.pay = { v: "self", q: m[0] };
  else if ((m = t.match(/\b(insurance[^.]{0,24})/i))) r.pay = { v: "partial", q: m[0] };
  else if ((m = t.match(/\b(government|employer|ministry)\b/i))) r.pay = { v: "program", q: m[0] };

  m = t.match(/\bI['’]?m\s+(?:his|her|their)\s+(son|daughter|wife|husband|brother|sister|niece|nephew)(?:,?\s+([A-Z][a-z]+))?/i);
  if (m) r.mgr = { v: m[2] || "", rel: m[1].toLowerCase(), q: m[0] };
  else if ((m = t.match(/\bmy name is\s+([A-Z][a-z]+)/))) r.mgr = { v: m[1], rel: "", q: m[0] };

  if ((m = t.match(/\b(anywhere|open to (?:any|all)\w*)\b/i))) r.dest = { v: HOSPITALS.map((h) => h.id), q: m[0] };
  else {
    const named = HOSPITALS.filter((h) => new RegExp(`\\b(consider|compar|thinking|look)[^.]*${h.city}`, "i").test(t)).map((h) => h.id);
    if (named.length) r.dest = { v: named, q: `considering ${named.length} cities` };
  }
  return r;
}

/** How many separate details the story gave (patient-for-self and relation count once). */
export function countFound(r: Found): number {
  const keys = ["rel", "self", "name", "age", "dx", "stage", "origin", "langs", "time", "budget", "pay", "mgr", "dest"] as const;
  return keys.filter((k) => r[k]).length - (r.rel && r.self ? 1 : 0);
}

/* =====================================================================
   Options: why each one fits, and the honest trade-off
   ===================================================================== */

export function explainOption(
  o: OptionResult,
  all: OptionResult[],
  money: (n: number) => string,
  originCity: string,
): { why: string; trade: string } {
  const cheapest = [...all].sort((a, b) => a.totals.expected - b.totals.expected)[0];
  const mostCases = [...all].sort((a, b) => b.specialist.cases - a.specialist.cases)[0];
  const soonest = [...all].sort((a, b) => a.apptDays - b.apptDays)[0];
  const parts: string[] = [];
  if (o.lang.direct.length) parts.push(o.lang.text);
  else if (o.lang.viaInterpreter.length) parts.push(o.lang.text.replace("provided", "on every ward"));
  if (o.route.mode === "drive") parts.push(`a ${o.route.label.replace(/ from .*/, "")} from ${originCity}, so family can visit easily`);
  else if (!o.visa.needed) parts.push("a short flight with no visa needed");
  if (o === cheapest) parts.unshift("The lowest expected total");
  if (o === mostCases) parts.push(`the most similar cases (${o.specialist.cases}) and ${o.specialist.years} years of experience`);
  if (o === soonest) parts.push("the soonest first appointment");
  const why = parts.length ? sentence(parts) : `${o.specialist.name} leads a team with ${o.specialist.cases} similar cases.`;

  let trade: string;
  if (o.budget.status === "above") {
    trade = `About ${money(o.budget.overBy)} above your budget${o.visa.needed ? `, and the ${o.visa.kind.toLowerCase()} adds about ${o.visa.days} days` : ""}.`;
  } else if (o.lang.gap) {
    trade = "Care is through interpreters rather than a team that speaks your language.";
  } else if (o !== mostCases && o.specialist.cases < mostCases.specialist.cases / 2) {
    trade = `Fewer similar cases than ${mostCases.hospital.city} (${o.specialist.cases} vs ${mostCases.specialist.cases}).`;
  } else {
    trade = o.hospital.couldChange.split(". ")[0].replace(/\.$/, "") + ".";
  }
  return { why, trade };
}

function sentence(parts: string[]): string {
  const s = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

/* =====================================================================
   Plan changes: turn "my brother wants to come too" into a costed draft
   ===================================================================== */

export type ChangeId = "companion" | "cheaper" | "moved";

export interface ChangeRow {
  item: string;
  from: string;
  to: string;
  cost: number;
}

export interface Scenario {
  id: ChangeId;
  ask: string;
  short: string;
  rows: ChangeRow[];
  pending: string[];
  note: string;
  /** Days the travel and treatment dates shift. */
  shiftDays: number;
  extraTravellers: number;
}

export const CHANGE_CHIPS: { id: ChangeId; label: string }[] = [
  { id: "companion", label: "Bring my brother too" },
  { id: "cheaper", label: "Lower our travel costs" },
  { id: "moved", label: "The appointment moved two days later" },
];

export function classifyChange(text: string): ChangeId {
  const s = text.toLowerCase();
  if (/brother|sister|wife|husband|son|daughter|come|bring|join|companion|partner/.test(s)) return "companion";
  if (/cheap|lower|less|save|budget|cost/.test(s)) return "cheaper";
  if (/move|moved|later|change|reschedul|date|delay/.test(s)) return "moved";
  return "companion";
}

export function scenario(id: ChangeId, ask: string, o: OptionResult, plan: Plan, day: (d: Date) => string): Scenario {
  const fl = o.route.mode === "flight";
  const stay = o.stayDays;
  const nightly = Math.round((o.lines.find((l) => l.id === "accommodation")?.expected ?? 0) / stay);
  const shift = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  if (id === "companion") {
    return {
      id, ask, short: "Companion joins", shiftDays: 0, extraTravellers: 1,
      rows: [
        fl
          ? { item: "Flights", from: "2 travellers", to: "3 travellers, same flights", cost: round10(o.route.main * 0.5) }
          : { item: "Drive", from: "Room for 2", to: "Room for 3, same car", cost: 0 },
        { item: "Accommodation", from: "Double room", to: `Family room · ${stay} nights`, cost: 20 * stay },
        { item: "Transfers", from: "4-seat vehicle", to: "Still fits", cost: 0 },
      ],
      pending: ["Hotel confirms a family room", fl ? "Fare held 24 hours (sample)" : "Parking at the hotel"],
      note: "Companion support and the treatment estimate don’t change.",
    };
  }
  if (id === "cheaper") {
    const nn = Math.round(nightly * 0.69);
    return {
      id, ask, short: "Cheaper stay", shiftDays: 0, extraTravellers: 0,
      rows: [
        { item: "Accommodation", from: "Partner hotel, 5 min away", to: "Serviced apartment, 25 min away", cost: -(nightly - nn) * stay },
        { item: "Local transport", from: "Hotel shuttle", to: "Longer daily car trips", cost: round10(stay * 5) },
        { item: "Travel days", from: o.route.label, to: "No change", cost: 0 },
      ],
      pending: [`Apartment availability for ${stay} nights`],
      note: "Trade-off: about 40 extra minutes of travel on each hospital day, and no shuttle.",
    };
  }
  return {
    id, ask, short: "Appointment +2 days", shiftDays: 2, extraTravellers: 0,
    rows: [
      { item: "First appointment", from: day(plan.first), to: day(shift(plan.first, 2)), cost: 0 },
      { item: fl ? "Flights" : "Drive", from: day(plan.travel), to: day(shift(plan.travel, 2)) + (fl ? " · flexible fare" : ""), cost: fl ? 60 : 0 },
      { item: "Stay and pickup", from: `Check-in ${day(plan.travel)}`, to: `Check-in ${day(shift(plan.travel, 2))}`, cost: 0 },
      { item: "Treatment", from: `Around ${day(plan.treatment)}`, to: `Around ${day(shift(plan.treatment, 2))}`, cost: 0 },
    ],
    pending: ["Hospital confirms the new treatment date"],
    note: "Recovery time and the return date stay as the clinicians specify.",
  };
}

/* =====================================================================
   Records: recognise a file from its name
   ===================================================================== */

const FILE_HINTS: [RegExp, string, string][] = [
  [/ct|tomograph/i, "ct", "CT scan"],
  [/colonoscop|scope|endoscop/i, "scope", "Colonoscopy report"],
  [/pet/i, "pet", "PET-CT scan"],
  [/biops|patholog|histolog/i, "biopsy", "Biopsy pathology report"],
  [/mmr|msi/i, "mmr", "MMR / MSI test"],
  [/cea|marker/i, "cea", "CEA tumor marker"],
  [/blood|cbc|lab/i, "blood", "Blood tests"],
  [/letter|referral|summary/i, "letter", "Doctor’s summary letter"],
  [/med|prescri|drug/i, "meds", "Medication list"],
  [/mammo|ultrasound/i, "mammo", "Mammogram and ultrasound"],
  [/mri/i, "mri", "MRI scan"],
  [/psa/i, "psa", "PSA results"],
  [/her2|receptor/i, "receptors", "Hormone receptor and HER2 results"],
];

/** Guess which checklist item a file belongs to. Returns the item key (without the diagnosis prefix). */
export function classifyFile(name: string): { key: string; found: string } | null {
  const hit = FILE_HINTS.find(([re]) => re.test(name));
  return hit ? { key: hit[1], found: hit[2] } : null;
}
