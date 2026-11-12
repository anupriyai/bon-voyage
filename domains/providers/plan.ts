import { z } from "zod/v4";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Choose a real calendar date");

/** Planning choices only: no medical notes, identities, passports or payment details. */
export const CarePlanSchema = z.object({
  offerId: z.string().min(1).max(100),
  from: z.union([z.literal(""), z.string().regex(/^[A-Z]{3}$/)]),
  out: z.union([z.literal(""), day]),
  back: z.union([z.literal(""), day]),
  travellers: z.number().int().min(1).max(9),
  flightId: z.string().min(1).max(500).nullable(),
  stayQuoteId: z.string().min(1).max(2000).nullable(),
}).strict().superRefine((value, context) => {
  if (!!value.out !== !!value.back || (value.out && value.back <= value.out)) {
    context.addIssue({ code: "custom", path: ["back"], message: "Choose an arrival and a later departure date" });
  }
  if (value.flightId && (!value.from || !value.out || !value.back)) {
    context.addIssue({ code: "custom", path: ["flightId"], message: "Flight choices need complete travel details" });
  }
  if (value.stayQuoteId && (!value.out || !value.back)) {
    context.addIssue({ code: "custom", path: ["stayQuoteId"], message: "A stay needs travel dates" });
  }
});
export type CarePlanDraft = z.infer<typeof CarePlanSchema>;
export const SaveCarePlanSchema = z.object({
  id: z.uuid().optional(), revision: z.number().int().min(1).nullable().optional(), draft: CarePlanSchema,
}).strict();
export const CareRequestSchema = z.object({ planId: z.uuid(), revision: z.number().int().min(1), attemptId: z.uuid() }).strict();
export interface SavedCarePlan {
  id: string; revision: number; draft: CarePlanDraft; createdAt: string; updatedAt: string;
}
export const SAMPLE_REQUEST_MESSAGE = "Sample care request recorded. No clinic was contacted, no appointment was confirmed and no travel was reserved.";
export interface CareRequest {
  id: string; planId: string; planRevision: number; status: "sample"; createdAt: string;
  message: string; draft: CarePlanDraft; providerName: string;
}
