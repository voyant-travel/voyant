DO $$ BEGIN
 CREATE TYPE "public"."source_connection_health_status" AS ENUM('unknown', 'healthy', 'degraded', 'failing');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."source_connection_status" AS ENUM('draft', 'active', 'paused', 'degraded', 'disconnecting', 'disconnected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."source_connection_truth_mode" AS ENUM('native', 'mirrored', 'external-live', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "source_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"source_kind" text NOT NULL,
	"display_name" text NOT NULL,
	"capability_scope" text NOT NULL,
	"source_of_truth_mode" "source_connection_truth_mode" NOT NULL,
	"status" "source_connection_status" DEFAULT 'draft' NOT NULL,
	"credential_ref" text,
	"credential_ref_version" text,
	"source_account_id" text,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health_status" "source_connection_health_status" DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_healthy_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"retry_after_at" timestamp with time zone,
	"rate_limit_state" jsonb,
	"cursor_state" jsonb,
	"disconnect_behavior" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disconnect_reason" text,
	"disconnect_requested_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_source_connections_source_kind" ON "source_connections" USING btree ("source_kind");--> statement-breakpoint
CREATE INDEX "idx_source_connections_scope_status" ON "source_connections" USING btree ("capability_scope","status");--> statement-breakpoint
CREATE INDEX "idx_source_connections_truth_mode" ON "source_connections" USING btree ("source_of_truth_mode");--> statement-breakpoint
CREATE INDEX "idx_source_connections_health" ON "source_connections" USING btree ("health_status","last_checked_at");--> statement-breakpoint
CREATE INDEX "idx_source_connections_granted_scopes_gin" ON "source_connections" USING gin ("granted_scopes");--> statement-breakpoint
CREATE INDEX "idx_source_connections_capabilities_gin" ON "source_connections" USING gin ("capabilities");