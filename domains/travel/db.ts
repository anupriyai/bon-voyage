import { sql } from "drizzle-orm";
import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { cases } from "@/domains/case/server";
import { user } from "@/domains/account/schema";
const at = (name: string) => timestamp(name, { withTimezone: true });
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(), caseId: uuid("case_id").notNull().references(() => cases.id),
  attemptId: uuid("attempt_id").notNull().unique(), resource: text("resource").notNull().default("flight"),
  provider: text("provider").notNull(), offerId: text("offer_id").notNull(), orderId: text("order_id").unique(),
  bookingType: text("booking_type").notNull(), status: text("status").notNull(), total: numeric("total", { precision: 14, scale: 2 }).notNull(), currency: text("currency").notNull(),
  payBy: at("pay_by"), paidAt: at("paid_at"), priceGuaranteeExpiresAt: at("price_guarantee_expires_at"), voidWindowEndsAt: at("void_window_ends_at"),
  bookedBy: text("booked_by").notNull().references(() => user.id), requestHash: text("request_hash").notNull(),
  paymentAttemptId: uuid("payment_attempt_id").unique(), bookingReference: text("booking_reference"), scheduleChanged: boolean("schedule_changed").notNull().default(false),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: at("created_at").notNull().defaultNow(), updatedAt: at("updated_at").notNull().defaultNow(),
}, (t) => [index("bookings_case_idx").on(t.caseId), uniqueIndex("bookings_active_case_resource_idx").on(t.caseId, t.resource).where(sql`${t.status} in ('creating','checking','held','confirmed','payment_checking','cancel_requested')`)]);
export const coordinatorTasks = pgTable("coordinator_tasks", {
  id: uuid("id").primaryKey().defaultRandom(), bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  kind: text("kind").notNull(), status: text("status").notNull().default("pending"), createdAt: at("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("coordinator_tasks_booking_kind_idx").on(t.bookingId, t.kind)]);
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(), provider: text("provider").notNull(), eventType: text("event_type").notNull(), eventKey: text("event_key").notNull(), eventId: text("event_id").notNull(), receivedAt: at("received_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("webhook_events_dedupe_idx").on(t.provider, t.eventType, t.eventKey)]);
export type Booking = typeof bookings.$inferSelect;

export const staySearches = pgTable("stay_searches", {
  id: uuid("id").primaryKey().defaultRandom(), caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }), ownerId: text("owner_id").notNull().references(() => user.id), provider: text("provider").notNull(), parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(), results: jsonb("results").$type<unknown[]>().notNull(), createdAt: at("created_at").notNull().defaultNow(),
});
export const stayQuotes = pgTable("stay_quotes", {
  id: uuid("id").primaryKey().defaultRandom(), searchId: uuid("search_id").notNull().references(() => staySearches.id, { onDelete: "cascade" }), caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }), quoteId: text("quote_id").notNull(), data: jsonb("data").$type<Record<string, unknown>>().notNull(), expiresAt: at("expires_at").notNull(), createdAt: at("created_at").notNull().defaultNow(),
});
