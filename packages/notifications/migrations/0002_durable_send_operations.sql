DO $$ BEGIN
 CREATE TYPE "public"."notification_send_operation_status" AS ENUM('pending', 'processing', 'retry', 'sent', 'dead_letter');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "notification_send_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"command_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"claim_action_id" text NOT NULL,
	"organization_id" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"delivery_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_idempotency_key" text NOT NULL,
	"request_payload" jsonb NOT NULL,
	"result_snapshot" jsonb NOT NULL,
	"status" "notification_send_operation_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_send_operations_claim_action_id_unique" UNIQUE("claim_action_id"),
	CONSTRAINT "notification_send_operations_delivery_id_notification_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE restrict ON UPDATE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_send_operations_command" ON "notification_send_operations" USING btree ("command_scope","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_send_operations_provider_key" ON "notification_send_operations" USING btree ("provider","provider_idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_notification_send_operations_due" ON "notification_send_operations" USING btree ("status","next_attempt_at","lease_expires_at");--> statement-breakpoint
CREATE INDEX "idx_notification_send_operations_delivery" ON "notification_send_operations" USING btree ("delivery_id");
