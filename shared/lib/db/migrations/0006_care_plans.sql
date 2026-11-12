CREATE TABLE "care_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_revision" integer NOT NULL,
	"attempt_id" uuid NOT NULL,
	"status" text DEFAULT 'sample' NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_plan_id_care_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."care_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_requests_owner_attempt_idx" ON "care_requests" USING btree ("owner_id","attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "care_requests_owner_plan_revision_idx" ON "care_requests" USING btree ("owner_id","plan_id","plan_revision");
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.care_plans FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'ciphertext', 'iv', 'auth_tag', 'key_version');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.care_requests FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'ciphertext', 'iv', 'auth_tag', 'key_version');
