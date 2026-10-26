// A patient's case, its encrypted clinical details, and the people travelling. All three are audited.
import { sql } from "drizzle-orm";
import { customType, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "@/domains/account/index";

const at = (name: string) => timestamp(name, { withTimezone: true });
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  status: text("status", { enum: ["draft", "matching", "planning", "booked", "travelling", "done"] })
    .notNull()
    .default("draft"),
  originCity: text("origin_city"),
  hospitalId: text("hospital_id"),
  appointmentDate: date("appointment_date"),
  treatmentDays: integer("treatment_days"),
  recoveryDays: integer("recovery_days"),
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

/** Story, diagnosis and stage, sealed with shared/lib/db/crypto (context = case id). */
export const caseClinical = pgTable("case_clinical", {
  caseId: uuid("case_id")
    .primaryKey()
    .references(() => cases.id, { onDelete: "cascade" }),
  ciphertext: bytea("ciphertext").notNull(),
  iv: bytea("iv").notNull(),
  authTag: bytea("auth_tag").notNull(),
  keyVersion: integer("key_version").notNull(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

/** Passport and document numbers go straight to the airline and are never stored here. */
export const travelers = pgTable("travelers", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["patient", "companion"] }).notNull(),
  givenName: text("given_name").notNull(),
  familyName: text("family_name").notNull(),
  bornOn: date("born_on"),
  /** e.g. wheelchair; airlines are asked manually after booking (Duffel has no field for it). */
  needs: text("needs").array().notNull().default(sql`'{}'::text[]`),
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});
