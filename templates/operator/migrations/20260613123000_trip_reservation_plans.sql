CREATE TYPE "public"."trip_reservation_plan_status" AS ENUM('pending', 'submitted', 'reserved', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "trip_reservation_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope_id" text NOT NULL,
	"snapshot_id" text,
	"status" "trip_reservation_plan_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text,
	"refresh_scope" jsonb,
	"component_count" integer DEFAULT 0 NOT NULL,
	"components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failures" jsonb DEFAULT '[]'::jsonb,
	"compensations" jsonb DEFAULT '[]'::jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_reservation_plans" ADD CONSTRAINT "trip_reservation_plans_envelope_id_trip_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."trip_envelopes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_reservation_plans" ADD CONSTRAINT "trip_reservation_plans_snapshot_id_trip_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trip_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trip_reservation_plans_envelope_created" ON "trip_reservation_plans" USING btree ("envelope_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_trip_reservation_plans_snapshot" ON "trip_reservation_plans" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_trip_reservation_plans_status_updated" ON "trip_reservation_plans" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_trip_reservation_plans_idempotency" ON "trip_reservation_plans" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_reservation_plan" ON "booking_origins" USING btree ("reservation_plan_id");
