// Better Auth's tables (user, session, account, verification), with our `role` on user.
// Property names must match Better Auth's field names; columns are snake_case.
import { boolean, customType, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const at = (name: string) => timestamp(name, { withTimezone: true });

export const ROLES = ["patient", "caregiver", "coordinator", "doctor", "developer"] as const;
export type Role = (typeof ROLES)[number];

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ROLES }).notNull().default("patient"),
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: at("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: at("access_token_expires_at"),
  refreshTokenExpiresAt: at("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: at("expires_at").notNull(),
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

// Matches the installed @better-auth/passkey 1.7.12 plugin schema.
export const passkey = pgTable("passkey", {
  id: text("id").primaryKey(), name: text("name"), publicKey: text("public_key").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull().unique(), counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(), backedUp: boolean("backed_up").notNull(),
  transports: text("transports"), createdAt: at("created_at"), aaguid: text("aaguid"),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
/** Only ownership/version metadata is plaintext. Name, residence and preferences are sealed. */
export const accountProfile = pgTable("account_profile", {
  userId: text("user_id").primaryKey().references(() => user.id),
  revision: integer("revision").notNull().default(1),
  ciphertext: bytea("ciphertext").notNull(), iv: bytea("iv").notNull(), authTag: bytea("auth_tag").notNull(), keyVersion: integer("key_version").notNull(),
  createdAt: at("created_at").notNull().defaultNow(), updatedAt: at("updated_at").notNull().defaultNow(),
});

export const consentReceipt = pgTable("consent_receipt", {
  id: uuid("id").primaryKey().defaultRandom(), userId: text("user_id").notNull().references(() => user.id),
  countryCode: text("country_code").notNull(), purpose: text("purpose").notNull(),
  documentVersion: text("document_version").notNull(), acceptedAt: at("accepted_at").notNull().defaultNow(),
  withdrawnAt: at("withdrawn_at"),
});

export const dataRightsRequest = pgTable("data_rights_request", {
  id: uuid("id").primaryKey().defaultRandom(), userId: text("user_id").notNull().references(() => user.id),
  kind: text("kind", { enum: ["access", "delete", "correct"] }).notNull(),
  status: text("status", { enum: ["pending", "in_review", "completed", "declined"] }).notNull().default("pending"),
  createdAt: at("created_at").notNull().defaultNow(), updatedAt: at("updated_at").notNull().defaultNow(),
});

/** Operational gate: no country is active without a reviewed policy and operator action. */
export const jurisdictionRelease = pgTable("jurisdiction_release", {
  countryCode: text("country_code").primaryKey(), policyVersion: text("policy_version").notNull(),
  enabled: boolean("enabled").notNull().default(false), approvedBy: text("approved_by").notNull(),
  approvedAt: at("approved_at").notNull(), expiresAt: at("expires_at").notNull(),
});
