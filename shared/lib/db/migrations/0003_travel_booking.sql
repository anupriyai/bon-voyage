CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"resource" text DEFAULT 'flight' NOT NULL,
	"provider" text NOT NULL,
	"offer_id" text NOT NULL,
	"order_id" text,
	"booking_type" text NOT NULL,
	"status" text NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"pay_by" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"price_guarantee_expires_at" timestamp with time zone,
	"void_window_ends_at" timestamp with time zone,
	"booked_by" text NOT NULL,
	"request_hash" text NOT NULL,
	"payment_attempt_id" uuid,
	"booking_reference" text,
	"schedule_changed" boolean DEFAULT false NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "bookings_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "bookings_payment_attempt_id_unique" UNIQUE("payment_attempt_id")
);
--> statement-breakpoint
CREATE TABLE "coordinator_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"event_key" text NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booked_by_user_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordinator_tasks" ADD CONSTRAINT "coordinator_tasks_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_case_idx" ON "bookings" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_active_case_resource_idx" ON "bookings" USING btree ("case_id","resource") WHERE "bookings"."status" in ('creating','checking','held','confirmed','payment_checking','cancel_requested');--> statement-breakpoint
CREATE UNIQUE INDEX "coordinator_tasks_booking_kind_idx" ON "coordinator_tasks" USING btree ("booking_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_dedupe_idx" ON "webhook_events" USING btree ("provider","event_type","event_key");--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'booking_reference', 'request_hash', 'details');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.coordinator_tasks FOR EACH ROW EXECUTE FUNCTION audit.capture('id');
