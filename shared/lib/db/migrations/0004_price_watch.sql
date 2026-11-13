CREATE TABLE "email_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"day" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_lock" (
	"name" text PRIMARY KEY NOT NULL,
	"lease_owner" uuid,
	"lease_until" timestamp with time zone,
	"last_slot" text
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watch_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"from_amount" numeric(14, 2) NOT NULL,
	"to_amount" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"slot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"search_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"provider" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"baseline" numeric(14, 2),
	"lowest" numeric(14, 2),
	"currency" text NOT NULL,
	"threshold_pct" integer DEFAULT 5 NOT NULL,
	"threshold_amount" numeric(14, 2) DEFAULT '30' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_slot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"limit" integer NOT NULL,
	"remaining" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_digests" ADD CONSTRAINT "email_digests_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_watch_id_price_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."price_watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_digests_owner_day_idx" ON "email_digests" USING btree ("owner_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "price_alerts_watch_slot_idx" ON "price_alerts" USING btree ("watch_id","slot");--> statement-breakpoint
CREATE INDEX "price_watches_due_idx" ON "price_watches" USING btree ("active","last_checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_watches_search_offer_idx" ON "price_watches" USING btree ("owner_id","search_id","offer_id");--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.price_watches FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'parameters');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.price_alerts FOR EACH ROW EXECUTE FUNCTION audit.capture('id');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.email_digests FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'payload');
