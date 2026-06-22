DO $$ BEGIN
 CREATE TYPE "public"."trip_candidate_status" AS ENUM('ranked', 'selected', 'expired', 'discarded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trip_requirement_status" AS ENUM('open', 'sourcing', 'candidates_ready', 'selected', 'no_availability', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "trip_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"requirement_id" text NOT NULL,
	"envelope_id" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"status" "trip_candidate_status" DEFAULT 'ranked' NOT NULL,
	"candidate_ref" text NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_connection_id" text,
	"source_module" text,
	"selection" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_currency" text NOT NULL,
	"price_amount" text NOT NULL,
	"expires_at" timestamp with time zone,
	"provider_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope_id" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"status" "trip_requirement_status" DEFAULT 'open' NOT NULL,
	"title" text,
	"description" text,
	"vertical" text NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criteria_version" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"selected_candidate_id" text,
	"resolved_component_id" text,
	"last_sourced_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_candidates" ADD CONSTRAINT "trip_candidates_requirement_id_trip_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."trip_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_candidates" ADD CONSTRAINT "trip_candidates_envelope_id_trip_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."trip_envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requirements" ADD CONSTRAINT "trip_requirements_envelope_id_trip_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."trip_envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trip_candidates_requirement_rank" ON "trip_candidates" USING btree ("requirement_id","rank");--> statement-breakpoint
CREATE INDEX "idx_trip_candidates_requirement_status" ON "trip_candidates" USING btree ("requirement_id","status");--> statement-breakpoint
CREATE INDEX "idx_trip_candidates_envelope" ON "trip_candidates" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "idx_trip_candidates_expires" ON "trip_candidates" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_trip_requirements_envelope_sequence" ON "trip_requirements" USING btree ("envelope_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_trip_requirements_envelope_status" ON "trip_requirements" USING btree ("envelope_id","status");