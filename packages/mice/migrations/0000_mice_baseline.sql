DO $$ BEGIN
 CREATE TYPE "public"."mice_program_status" AS ENUM('lead', 'planning', 'contracted', 'operating', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mice_program_type" AS ENUM('meeting', 'incentive', 'conference', 'exhibition', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "mice_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"primary_contact_person_id" text,
	"account_manager_id" text,
	"name" text NOT NULL,
	"code" text,
	"type" "mice_program_type" DEFAULT 'conference' NOT NULL,
	"status" "mice_program_status" DEFAULT 'lead' NOT NULL,
	"destination" text,
	"start_date" date,
	"end_date" date,
	"estimated_pax" integer,
	"confirmed_pax" integer,
	"currency" text,
	"budget_amount_cents" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_mice_programs_org" ON "mice_programs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_mice_programs_status" ON "mice_programs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mice_programs_dates" ON "mice_programs" USING btree ("start_date","end_date");