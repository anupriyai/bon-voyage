import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { cases, searches } from "@/domains/case/server";
import { user } from "@/domains/account/schema";
const at = (name: string) => timestamp(name, { withTimezone: true });
export const priceWatches = pgTable("price_watches", {
  id: uuid("id").primaryKey().defaultRandom(), caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }), searchId: uuid("search_id").notNull().references(() => searches.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => user.id), offerId: text("offer_id").notNull(), provider: text("provider").notNull(), parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
  baseline: numeric("baseline", { precision: 14, scale: 2 }), lowest: numeric("lowest", { precision: 14, scale: 2 }), currency: text("currency").notNull(), thresholdPct: integer("threshold_pct").notNull().default(5), thresholdAmount: numeric("threshold_amount", { precision: 14, scale: 2 }).notNull().default("30"),
  active: boolean("active").notNull().default(true), lastCheckedAt: at("last_checked_at"), lastSlot: text("last_slot"), createdAt: at("created_at").notNull().defaultNow(),
}, (t) => [index("price_watches_due_idx").on(t.active, t.lastCheckedAt), uniqueIndex("price_watches_search_offer_idx").on(t.ownerId, t.searchId, t.offerId)]);
export const priceAlerts = pgTable("price_alerts", {
  id: uuid("id").primaryKey().defaultRandom(), watchId: uuid("watch_id").notNull().references(() => priceWatches.id, { onDelete: "cascade" }), ownerId: text("owner_id").notNull().references(() => user.id),
  from: numeric("from_amount", { precision: 14, scale: 2 }).notNull(), to: numeric("to_amount", { precision: 14, scale: 2 }).notNull(), currency: text("currency").notNull(), slot: text("slot").notNull(), createdAt: at("created_at").notNull().defaultNow(), readAt: at("read_at"),
}, (t) => [uniqueIndex("price_alerts_watch_slot_idx").on(t.watchId, t.slot)]);
export const jobLock = pgTable("job_lock", { name: text("name").primaryKey(), leaseOwner: uuid("lease_owner"), leaseUntil: at("lease_until"), lastSlot: text("last_slot") });
export const rateLimit = pgTable("rate_limit", { keyHash: text("key_hash").primaryKey(), limit: integer("limit").notNull(), remaining: integer("remaining").notNull(), resetAt: at("reset_at").notNull(), updatedAt: at("updated_at").notNull().defaultNow() });
export const emailDigests = pgTable("email_digests", { id: uuid("id").primaryKey().defaultRandom(), ownerId: text("owner_id").notNull().references(() => user.id), day: text("day").notNull(), status: text("status").notNull(), payload: jsonb("payload").$type<{ to: string; count: number; appUrl: string }>().notNull(), providerId: text("provider_id"), createdAt: at("created_at").notNull().defaultNow() }, (t) => [uniqueIndex("email_digests_owner_day_idx").on(t.ownerId, t.day)]);
