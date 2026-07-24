CREATE TYPE "public"."trip_requirement_sourcing_operation_status" AS ENUM('pending', 'processing', 'retry', 'completed', 'dead_letter');--> statement-breakpoint
CREATE TABLE "trip_requirement_sourcing_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"command_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"organization_id" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"previous_requirement_status" "trip_requirement_status" NOT NULL,
	"request_snapshot" jsonb NOT NULL,
	"result_snapshot" jsonb NOT NULL,
	"outcome_snapshot" jsonb,
	"status" "trip_requirement_sourcing_operation_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"lease_version" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_requirement_sourcing_operations" ADD CONSTRAINT "trip_requirement_sourcing_operations_requirement_id_trip_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."trip_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_trip_requirement_sourcing_operations_command" ON "trip_requirement_sourcing_operations" USING btree ("command_scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_trip_requirement_sourcing_operations_due" ON "trip_requirement_sourcing_operations" USING btree ("status","next_attempt_at","lease_expires_at");--> statement-breakpoint
CREATE INDEX "idx_trip_requirement_sourcing_operations_requirement" ON "trip_requirement_sourcing_operations" USING btree ("requirement_id","status");
