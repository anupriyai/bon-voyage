import { customType, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "@/domains/account/schema";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const at = (name: string) => timestamp(name, { withTimezone: true });

/** Treatment and route choices are sealed together; only ownership/version metadata is plaintext. */
export const carePlans = pgTable("care_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  revision: integer("revision").notNull().default(1),
  ciphertext: bytea("ciphertext").notNull(), iv: bytea("iv").notNull(), authTag: bytea("auth_tag").notNull(),
  keyVersion: integer("key_version").notNull(),
  createdAt: at("created_at").notNull().defaultNow(), updatedAt: at("updated_at").notNull().defaultNow(),
});

/** The sealed snapshot is immutable through the application, independently of later plan edits. */
export const careRequests = pgTable("care_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  planId: uuid("plan_id").notNull().references(() => carePlans.id),
  planRevision: integer("plan_revision").notNull(), attemptId: uuid("attempt_id").notNull(),
  status: text("status", { enum: ["sample"] }).notNull().default("sample"),
  ciphertext: bytea("ciphertext").notNull(), iv: bytea("iv").notNull(), authTag: bytea("auth_tag").notNull(),
  keyVersion: integer("key_version").notNull(), createdAt: at("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("care_requests_owner_attempt_idx").on(table.ownerId, table.attemptId),
  uniqueIndex("care_requests_owner_plan_revision_idx").on(table.ownerId, table.planId, table.planRevision),
]);
