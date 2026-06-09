CREATE TABLE "trip_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope_id" text NOT NULL,
	"source_envelope_updated_at" timestamp with time zone NOT NULL,
	"title_snapshot" text,
	"description_snapshot" text,
	"traveler_party_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"currency" text NOT NULL,
	"subtotal_amount_cents" integer DEFAULT 0 NOT NULL,
	"tax_amount_cents" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"component_count" integer DEFAULT 0 NOT NULL,
	"priced_component_count" integer DEFAULT 0 NOT NULL,
	"frozen_envelope" jsonb NOT NULL,
	"frozen_components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_snapshots" ADD CONSTRAINT "trip_snapshots_envelope_id_trip_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."trip_envelopes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trip_snapshots_envelope_created" ON "trip_snapshots" USING btree ("envelope_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_trip_snapshots_created" ON "trip_snapshots" USING btree ("created_at");