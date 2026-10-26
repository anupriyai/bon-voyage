// What the assistant's models must answer with, shared by every provider (shared/lib/ai).
// Lenient on purpose: Claude's structured output doesn't enforce enum values server-side, and small local
// models vary letter case, so each field is lower-cased and, if still invalid, becomes null on its own
// instead of failing the whole answer.
import * as z from "zod/v4";
import type { Found } from "@/domains/case/model/assistant";

const lower = (v: unknown): unknown => (typeof v === "string" ? v.trim().toLowerCase() : Array.isArray(v) ? v.map(lower) : v);

const oneOf = <const T extends readonly [string, ...string[]]>(values: T) => z.preprocess(lower, z.enum(values));

const quote = z.string().describe("The exact words from the story this came from");

/** A detail and its source words; null when absent or invalid. */
const hit = <T extends z.ZodType>(v: T) => z.object({ v, q: quote }).nullable().catch(null);

export const FoundSchema = z.object({
  rel: hit(z.preprocess(lower, z.string()).describe("The patient relative to the writer, lower case, e.g. father")),
  self: hit(z.boolean().describe("true only when the writer is the patient")),
  name: hit(z.string().describe("Patient's name as written")),
  age: hit(z.string().regex(/^\d{1,3}$/).describe("Patient's age in years, digits only")),
  dx: hit(oneOf(["colon", "breast", "prostate", "lung", "other"])),
  stage: hit(oneOf(["1", "2", "3", "4", "unsure"])),
  origin: z
    .object({
      v: oneOf(["jordan", "saudi", "uae", "lebanon", "egypt", "uk", "nz", "other"]),
      city: z.string().describe("Home city, or the capital if only a country is named"),
      label: z.string().describe("e.g. 'Irbid, Jordan'"),
      q: quote,
    })
    .nullable()
    .catch(null),
  langs: hit(z.array(oneOf(["arabic", "english", "french", "turkish", "german"]))),
  time: hit(oneOf(["asap", "month", "quarter", "flexible"])),
  budget: hit(oneOf(["u25", "25-50", "50-100", "o100", "unsure"]).describe("Medical budget band in US dollars")),
  pay: hit(oneOf(["self", "partial", "program", "unsure"])),
  mgr: z
    .object({
      v: z.string().describe("Writer's first name, or empty"),
      rel: z.preprocess(lower, z.string()).describe("Writer relative to the patient, lower case, e.g. son"),
      q: quote,
    })
    .nullable()
    .catch(null),
  dest: hit(z.array(oneOf(["amman", "cairo", "istanbul", "dubai", "berlin"]))),
});

export const ChangeSchema = z.object({ id: oneOf(["companion", "cheaper", "moved"]) });

export const EXTRACT_SYSTEM = `You read a family's description of a cancer care situation and pull out the details a care coordinator needs. Fill a field only when the story states it; leave it null otherwise and never guess. Each "q" is the shortest exact phrase from the story that supports the value. You are not giving medical advice.`;

export const CHANGE_SYSTEM = `A family describes a change to their treatment-travel plan. Classify it: "companion" (someone else is coming along), "cheaper" (lower travel or stay costs), or "moved" (an appointment or date changed).`;

/** The UI's shape: absent fields dropped, and "self" kept only when true. */
export function toFound(parsed: z.infer<typeof FoundSchema>): Found {
  const { self, ...rest } = parsed;
  const entries: [string, unknown][] = Object.entries(rest).filter(([, v]) => v !== null);
  if (self?.v === true) entries.push(["self", { v: true, q: self.q }]);
  return Object.fromEntries(entries) as Found;
}
