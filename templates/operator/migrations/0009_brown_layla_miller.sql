CREATE TYPE "public"."tax_class_applies_to" AS ENUM('base', 'addon', 'accommodation', 'all');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_step_status" AS ENUM('running', 'succeeded', 'failed', 'skipped', 'compensated');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'awaiting_payment' BEFORE 'confirmed';--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"scope" text PRIMARY KEY NOT NULL,
	"tokens_available" numeric NOT NULL,
	"capacity" numeric NOT NULL,
	"refill_rate_per_sec" numeric NOT NULL,
	"last_refill_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"source_module" text NOT NULL,
	"source_event" text NOT NULL,
	"source_entity_module" text,
	"source_entity_id" text,
	"subscription_id" text,
	"target_url" text NOT NULL,
	"target_kind" text,
	"target_ref" text,
	"request_method" text NOT NULL,
	"request_headers" jsonb,
	"request_body_hash" text,
	"request_body_excerpt" text,
	"response_status" integer,
	"response_headers" jsonb,
	"response_body_excerpt" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"parent_delivery_id" text,
	"idempotency_key" text,
	"status" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error_class" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "availability_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"hold_token" text NOT NULL,
	"product_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"pax_count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_availability_push_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"source_connection_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"product_id" text NOT NULL,
	"option_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_content_push_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"source_connection_id" text NOT NULL,
	"product_id" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_pax_pricing_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"option_unit_id" text,
	"tier_pax" integer NOT NULL,
	"price_per_pax_cents" integer NOT NULL,
	"promo_price_per_pax_cents" integer,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"default_regime_id" text,
	"lines" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_connection_id" text,
	"source_ref" text,
	"draft_payload" jsonb NOT NULL,
	"current_step" text,
	"current_quote_id" text,
	"hold_expires_at" timestamp with time zone,
	"consumed_booking_id" text,
	"consumed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"step_name" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" "workflow_run_step_status" DEFAULT 'running' NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_name" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"correlation_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "workflow_run_status" DEFAULT 'running' NOT NULL,
	"input" jsonb,
	"result" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_workflow_runs_completion" CHECK ((
        "workflow_runs"."status" = 'running' AND "workflow_runs"."completed_at" IS NULL
      ) OR (
        "workflow_runs"."status" <> 'running' AND "workflow_runs"."completed_at" IS NOT NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "booking_item_id" text;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "source_kind" text;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "source_connection_id" text;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "push_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "push_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "last_push_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "pushed_payload_hash" text;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "channel_contracts" ADD COLUMN "rate_limit_rps" integer;--> statement-breakpoint
ALTER TABLE "channel_contracts" ADD COLUMN "rate_limit_burst" integer;--> statement-breakpoint
ALTER TABLE "channel_contracts" ADD COLUMN "rate_limit_priority_gates" jsonb;--> statement-breakpoint
ALTER TABLE "channel_contracts" ADD COLUMN "policy" jsonb;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "source_kind" text;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "source_connection_id" text;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "push_bookings" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "push_availability" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "push_content" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "policy" jsonb;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "last_pushed_content_hash" text;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD COLUMN "last_pushed_content_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "rate_limit_rps" integer;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "rate_limit_burst" integer;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "rate_limit_priority_gates" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_class_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "awaiting_payment_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "converted_from_invoice_id" text;--> statement-breakpoint
ALTER TABLE "booking_cruise_details" ADD COLUMN "air_arrangement" "cruise_air_arrangement";--> statement-breakpoint
ALTER TABLE "booking_cruise_details" ADD COLUMN "linked_flight_booking_id" text;--> statement-breakpoint
ALTER TABLE "booking_catalog_snapshot" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "availability_holds" ADD CONSTRAINT "availability_holds_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_availability_push_intents" ADD CONSTRAINT "channel_availability_push_intents_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_content_push_intents" ADD CONSTRAINT "channel_content_push_intents_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pax_pricing_tiers" ADD CONSTRAINT "product_pax_pricing_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pax_pricing_tiers" ADD CONSTRAINT "product_pax_pricing_tiers_option_unit_id_option_units_id_fk" FOREIGN KEY ("option_unit_id") REFERENCES "public"."option_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_pending" ON "webhook_deliveries" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_module" ON "webhook_deliveries" USING btree ("source_module","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_entity" ON "webhook_deliveries" USING btree ("source_entity_module","source_entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_idempotency" ON "webhook_deliveries" USING btree ("idempotency_key","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_subscription" ON "webhook_deliveries" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_target" ON "webhook_deliveries" USING btree ("target_kind","target_ref","created_at");--> statement-breakpoint
CREATE INDEX "idx_availability_holds_slot" ON "availability_holds" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "idx_availability_holds_draft" ON "availability_holds" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "idx_availability_holds_token" ON "availability_holds" USING btree ("hold_token");--> statement-breakpoint
CREATE INDEX "idx_availability_holds_expires" ON "availability_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_chan_avail_push_intents_requested" ON "channel_availability_push_intents" USING btree ("channel_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_chan_avail_push_intents_product" ON "channel_availability_push_intents" USING btree ("product_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_chan_avail_push_intents_per_slot" ON "channel_availability_push_intents" USING btree ("channel_id","slot_id");--> statement-breakpoint
CREATE INDEX "idx_chan_content_push_intents_requested" ON "channel_content_push_intents" USING btree ("channel_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_chan_content_push_intents_per_product" ON "channel_content_push_intents" USING btree ("channel_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_pax_tiers_product" ON "product_pax_pricing_tiers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pax_tiers_unit" ON "product_pax_pricing_tiers" USING btree ("option_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pax_tiers_unit_pax" ON "product_pax_pricing_tiers" USING btree ("option_unit_id","tier_pax");--> statement-breakpoint
CREATE INDEX "idx_tax_classes_code" ON "tax_classes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_tax_classes_active" ON "tax_classes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_entity" ON "booking_drafts" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_expires" ON "booking_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_created_by" ON "booking_drafts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_consumed" ON "booking_drafts" USING btree ("consumed_booking_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_run_steps_run" ON "workflow_run_steps" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_workflow_run_steps_status" ON "workflow_run_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_workflow" ON "workflow_runs" USING btree ("workflow_name","started_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_status_started" ON "workflow_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_correlation" ON "workflow_runs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_tags_gin" ON "workflow_runs" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_push_status" ON "channel_booking_links" USING btree ("push_status","last_push_at");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_booking_item" ON "channel_booking_links" USING btree ("booking_item_id") WHERE "channel_booking_links"."booking_item_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_channel_booking_links_per_item" ON "channel_booking_links" USING btree ("channel_id","booking_id",COALESCE("booking_item_id", ''));--> statement-breakpoint
CREATE INDEX "idx_channel_product_mappings_source_connection" ON "channel_product_mappings" USING btree ("source_connection_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_converted_from" ON "invoices" USING btree ("converted_from_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_bcd_air_arrangement" ON "booking_cruise_details" USING btree ("air_arrangement");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_catalog_snapshot_idempotency_uniq" ON "booking_catalog_snapshot" USING btree ("idempotency_key") WHERE idempotency_key is not null;