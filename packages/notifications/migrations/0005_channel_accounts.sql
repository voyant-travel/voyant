ALTER TYPE "notification_delivery_status" RENAME TO "notification_delivery_status_legacy";--> statement-breakpoint
CREATE TYPE "notification_delivery_status" AS ENUM('pending', 'accepted', 'delivered', 'failed', 'bounced', 'complained', 'suppressed', 'cancelled');--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "status" TYPE "notification_delivery_status" USING (CASE WHEN "status"::text = 'sent' THEN 'accepted' ELSE "status"::text END)::"notification_delivery_status";--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "notification_delivery_status_legacy";--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "channel" TYPE text USING "channel"::text;--> statement-breakpoint
CREATE TYPE "channel_account_lifecycle" AS ENUM('pending', 'active', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "channel_account_health" AS ENUM('unknown', 'healthy', 'degraded', 'unavailable');--> statement-breakpoint
CREATE TYPE "notification_delivery_event_status" AS ENUM('accepted', 'delivered', 'failed', 'bounced', 'complained', 'suppressed', 'cancelled');--> statement-breakpoint
CREATE TABLE "notification_channel_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"normalized_address" text NOT NULL,
	"display_name" text NOT NULL,
	"display_address" text NOT NULL,
	"lifecycle" "channel_account_lifecycle" DEFAULT 'pending' NOT NULL,
	"health" "channel_account_health" DEFAULT 'unknown' NOT NULL,
	"inbound_capable" boolean DEFAULT false NOT NULL,
	"outbound_capable" boolean DEFAULT false NOT NULL,
	"allowed_purposes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"adapter_ref" text NOT NULL,
	"last_validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "channel_account_id" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "qualified_target_type" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_account_id_notification_channel_accounts_id_fk" FOREIGN KEY ("channel_account_id") REFERENCES "public"."notification_channel_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "notification_delivery_events" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"adapter_ref" text NOT NULL,
	"adapter_event_id" text NOT NULL,
	"status" "notification_delivery_event_status" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notification_delivery_events" ADD CONSTRAINT "notification_delivery_events_delivery_id_notification_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_channel_accounts_channel_address" ON "notification_channel_accounts" USING btree ("channel","normalized_address");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_channel_accounts_adapter_ref" ON "notification_channel_accounts" USING btree ("adapter_ref");--> statement-breakpoint
CREATE INDEX "idx_notification_channel_accounts_lifecycle_health" ON "notification_channel_accounts" USING btree ("lifecycle","health");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_channel_account_created" ON "notification_deliveries" USING btree ("channel_account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_delivery_events_adapter_event" ON "notification_delivery_events" USING btree ("adapter_ref","adapter_event_id");--> statement-breakpoint
CREATE INDEX "idx_notification_delivery_events_delivery_occurred" ON "notification_delivery_events" USING btree ("delivery_id","occurred_at");
