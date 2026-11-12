import * as z from "zod/v4";
import type { CaseState } from "./caseState";
import { ORIGIN_BY_ID } from "@/domains/case/data/catalogue";

const text = z.string().max(4000);
const short = z.string().max(250);
const timestamp = z.iso.datetime({ offset: true });
const nullableTime = timestamp.nullable();
export const CaseIdSchema = z.uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const file = z.object({ name: short, size: z.number().nonnegative().max(100_000_000), at: timestamp, docDate: short.optional(), found: short.optional(), translated: z.boolean().optional() });
const intake = z.object({
  forWhom: z.enum(["self", "family"]).nullable(), patientName: short, age: z.string().max(3), relationship: short,
  patientRelation: short, managerName: short, patientSeesAll: z.boolean(), email: short, phone: short,
  contactVia: z.enum(["email", "whatsapp", "phone"]).nullable(), diagnosis: z.enum(["colon", "breast", "prostate", "lung", "other"]).nullable(),
  diagnosisOther: text, stage: z.enum(["1", "2", "3", "4", "unsure"]).nullable(),
  origin: z.string().refine((id) => Object.hasOwn(ORIGIN_BY_ID, id), "Choose a listed country").nullable(), originOther: short, originCity: short,
  languages: z.array(z.enum(["arabic", "english", "french", "turkish", "german"])).max(5),
  priorities: z.array(z.enum(["experience", "language", "cost", "family", "speed"])).max(5),
  budget: z.enum(["u25", "25-50", "50-100", "o100", "unsure"]).nullable(), insurance: z.enum(["self", "partial", "program", "unsure"]).nullable(),
  destinations: z.array(z.enum(["home", "gulf", "levant", "turkey", "europe"])).max(5), timeline: z.enum(["asap", "month", "quarter", "flexible"]).nullable(),
});

// Only validated case and travel fields are persisted. Passport/document payloads belong to the
// provider booking request, never the encrypted case. Scheduling columns are validated separately.
export const CaseStateSchema = z.object({
  staySelection: z.object({ localQuoteId: z.uuid(), quoteId: z.string().max(1500), name: short, amount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), dueAtAccommodation: z.number().finite().nonnegative().nullable(), dueCurrency: z.string().regex(/^[A-Z]{3}$/), usdAmount: z.number().finite().nonnegative(), context: z.string().max(2000), checkIn: day, checkOut: day, sample: z.boolean() }).strict().nullable().default(null),
  travelSchedule: z.object({ appointment: day, treatmentDays: z.number().int().min(1).max(730), recoveryDays: z.number().int().min(0).max(730), passengers: z.number().int().min(1).max(9), companionAges: z.array(z.number().int().min(0).max(120)).max(8).optional(), wheelchair: z.boolean(), flexDays: z.union([z.literal(0), z.literal(1)]) }).strict().nullable().default(null),
  flightSelection: z.object({ id: short, amount: z.number().finite().min(0).max(10_000_000), currency: z.string().regex(/^[A-Z]{3}$/), usdAmount: z.number().finite().min(0).max(10_000_000).optional(), fareAmount: z.number().finite().nonnegative().optional(), fees: z.number().finite().nonnegative().optional(), extraGround: z.number().finite().nonnegative().optional(), mode: z.enum(["sample", "test", "live"]).optional(), searchId: z.uuid().optional(), context: z.string().max(2000), from: z.string().regex(/^[A-Z]{3}$/), to: z.string().regex(/^[A-Z]{3}$/), out: day, back: day, sample: z.boolean(), selectedAt: timestamp }).strict().nullable().default(null),
  id: CaseIdSchema, updatedAt: timestamp, intake, draftStep: z.number().int().min(1).max(20), complete: z.boolean(), createdAt: nullableTime, sample: z.boolean(),
  records: z.record(short, z.object({ files: z.array(file).max(100), courier: z.boolean().optional(), requested: z.boolean().optional() })),
  unsorted: z.array(file).max(100), secondOpinionAt: nullableTime, secondOpinionSkipped: z.boolean(), passportAdded: z.boolean(),
  health: z.record(short, text), costView: z.enum(["low", "expected", "high"]), chosenId: z.enum(["amman", "cairo", "istanbul", "dubai", "berlin"]).nullable(), chosenAt: nullableTime,
  owners: z.record(short, z.enum(["bv", "self"])), taskStatus: z.record(short, z.enum(["na", "not_started", "in_progress", "done"])), consultSlot: short.nullable(), planApprovedAt: nullableTime,
  scanDecision: z.enum(["pending", "approved", "cheaper"]), approved: z.array(z.object({ id: short, label: short, amount: z.number().finite(), at: timestamp })).max(200),
  chat: z.array(z.object({ from: z.enum(["you", "coordinator"]), text, at: timestamp })).max(1000),
}).strict().transform((value) => value as CaseState);

export const ScheduleSchema = z.object({
  appointmentDate: day.nullable().optional(), treatmentDays: z.number().int().min(1).max(730).nullable().optional(), recoveryDays: z.number().int().min(0).max(730).nullable().optional(),
}).strict();

export const SaveCaseSchema = z.object({ state: CaseStateSchema, revision: z.number().int().nonnegative().nullable(), schedule: ScheduleSchema.optional() }).strict();
export type SaveCaseInput = z.infer<typeof SaveCaseSchema>;
export const TravelerSchema = z.object({
  role: z.enum(["patient", "companion"]), givenName: short.min(1), familyName: short.min(1), bornOn: day.nullable().optional(),
  needs: z.array(z.enum(["wheelchair", "mobility", "visual", "hearing"])).max(4).default([]),
}).strict();
export type TravelerInput = z.infer<typeof TravelerSchema>;

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/account";
  if (value === "/account" || value === "/start" || /^\/case(?:\/|\?|$)/.test(value)) return value;
  if (/^\/explore\/trip(?:\?|$)/.test(value)) return value;
  return "/account";
}
