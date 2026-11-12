import { z } from "zod/v4";
import { addDays } from "@/domains/pricing";
const day = z.string().refine((s) => { try { return addDays(s, 0) === s; } catch { return false; } });
const name = z.string().trim().min(1).max(20).regex(/^[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ '-]+$/).refine((s) => !/[ÆæĲĳŒœÞþÐð]/.test(s));
export const BookingTravelerSchema = z.object({
  givenName: name, familyName: name, bornOn: day, title: z.enum(["mr", "mrs", "ms", "miss", "dr"]), gender: z.enum(["m", "f"]),
  email: z.email().max(250), phone: z.string().regex(/^\+[1-9]\d{6,14}$/), infantFor: z.number().int().min(0).max(8).optional(),
  document: z.object({ number: z.string().min(3).max(30).regex(/^[A-Za-z0-9]+$/), issuingCountry: z.string().regex(/^[A-Z]{2}$/), expiresOn: day }).strict().optional(),
}).strict().refine((v) => v.givenName.length + v.familyName.length <= 40);
export const BookFlightSchema = z.object({ caseId: z.uuid(), searchId: z.uuid(), offerId: z.string().min(1).max(250), attemptId: z.uuid(), type: z.enum(["instant", "hold"]), expectedAmount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), acceptedConditions: z.literal(true), travelers: z.array(BookingTravelerSchema).min(1).max(9), assistance: z.boolean().default(false) }).strict();
export type BookFlightInput = z.infer<typeof BookFlightSchema>;
export function ageOn(born: string, day: string) {
  return Number(day.slice(0, 4)) - Number(born.slice(0, 4)) - (day.slice(5) < born.slice(5) ? 1 : 0);
}
export function validateParty(input: BookFlightInput, departure: string) {
  const ages = input.travelers.map((p) => ageOn(p.bornOn, departure));
  if (ages.some((age) => age < 0 || age > 120)) throw new Error("invalid_travelers");
  const carriers = new Set<number>();
  ages.forEach((age, i) => {
    const traveler = input.travelers[i];
    if (traveler.document && traveler.document.expiresOn <= departure) throw new Error("invalid_travelers");
    if (age < 2) {
      const adult = traveler.infantFor;
      if (adult === undefined || ages[adult] < 18 || !input.travelers[adult] || carriers.has(adult)) throw new Error("invalid_travelers");
      carriers.add(adult);
    } else if (traveler.infantFor !== undefined) throw new Error("invalid_travelers");
  });
}
