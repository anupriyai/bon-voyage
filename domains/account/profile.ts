import { z } from "zod/v4";
import { COUNTRIES } from "@/domains/providers/countries";

const countryCodes = new Set(COUNTRIES.map((country) => country.code));
export const ProfileInput = z.object({
  displayName: z.string().trim().min(1).max(100),
  accountKind: z.enum(["patient", "caregiver"]),
  residenceCountry: z.string().refine((value) => countryCodes.has(value), "Choose a listed country or territory"),
  preferredLanguage: z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).max(35),
  timeZone: z.string().trim().min(1).max(80),
  adultConfirmed: z.literal(true),
}).strict();
export const SaveProfileInput = z.object({ revision: z.number().int().min(0), profile: ProfileInput }).strict();
export type ProfileData = z.infer<typeof ProfileInput>;
export type ProfileView = { revision: number; email: string; emailVerified: boolean; profile: ProfileData | null };
export const DataRequestInput = z.object({ kind: z.enum(["access", "delete", "correct"]) }).strict();
