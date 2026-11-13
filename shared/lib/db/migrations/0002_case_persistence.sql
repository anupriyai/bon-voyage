CREATE TABLE "fare_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"offer_id" text NOT NULL,
	"slices" jsonb NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"parameters" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fare_snapshots_search_idx" ON "fare_snapshots" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "searches_case_created_idx" ON "searches" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.searches FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'parameters');
--> statement-breakpoint
DROP TRIGGER audit ON public.cases;
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.cases FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'origin_city', 'hospital_id', 'appointment_date', 'treatment_days', 'recovery_days');
--> statement-breakpoint
DROP TRIGGER audit ON public.travelers;
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.travelers FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'given_name', 'family_name', 'born_on', 'needs');
--> statement-breakpoint
CREATE FUNCTION public.refuse_fare_snapshot_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'fare_snapshots are insert-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_fare_snapshots BEFORE UPDATE OR DELETE ON public.fare_snapshots FOR EACH ROW EXECUTE FUNCTION public.refuse_fare_snapshot_change();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON public.fare_snapshots FROM bv_app;
