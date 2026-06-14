CREATE TYPE "public"."trip_component_event_type" AS ENUM('created', 'updated', 'priced', 'hold_placed', 'booked', 'checkout_started', 'failed', 'cancelled', 'removed', 'staff_remediation_required');--> statement-breakpoint
CREATE TYPE "public"."trip_component_kind" AS ENUM('catalog_booking', 'manual_placeholder', 'flight_placeholder', 'flight_order', 'external_order');--> statement-breakpoint
CREATE TYPE "public"."trip_component_status" AS ENUM('draft', 'priced', 'unavailable', 'held', 'booked', 'checkout_started', 'failed', 'cancelled', 'removed');--> statement-breakpoint
CREATE TYPE "public"."trip_envelope_status" AS ENUM('draft', 'priced', 'reserve_in_progress', 'reserved', 'checkout_started', 'booked', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "trip_component_events" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope_id" text NOT NULL,
	"component_id" text,
	"event_type" "trip_component_event_type" NOT NULL,
	"from_status" "trip_component_status",
	"to_status" "trip_component_status",
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_components" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope_id" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"kind" "trip_component_kind" NOT NULL,
	"status" "trip_component_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"description" text,
	"entity_module" text,
	"entity_id" text,
	"source_kind" text,
	"source_connection_id" text,
	"source_ref" text,
	"booking_draft_id" text,
	"catalog_quote_id" text,
	"booking_id" text,
	"booking_group_id" text,
	"order_id" text,
	"payment_session_id" text,
	"provider_ref" text,
	"supplier_ref" text,
	"component_currency" text,
	"component_subtotal_amount_cents" integer,
	"component_tax_amount_cents" integer,
	"component_total_amount_cents" integer,
	"pricing_snapshot" jsonb,
	"tax_lines" jsonb DEFAULT '[]'::jsonb,
	"cancellation_snapshot" jsonb,
	"hold_token" text,
	"hold_expires_at" timestamp with time zone,
	"price_expires_at" timestamp with time zone,
	"warning_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_envelopes" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "trip_envelope_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"description" text,
	"traveler_party" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aggregate_currency" text,
	"aggregate_subtotal_amount_cents" integer,
	"aggregate_tax_amount_cents" integer,
	"aggregate_total_amount_cents" integer,
	"aggregate_pricing_snapshot" jsonb,
	"current_price_expires_at" timestamp with time zone,
	"booking_group_id" text,
	"order_id" text,
	"payment_session_id" text,
	"reserve_idempotency_key" text,
	"reserve_started_at" timestamp with time zone,
	"reserved_at" timestamp with time zone,
	"checkout_idempotency_key" text,
	"checkout_started_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_component_events" ADD CONSTRAINT "trip_component_events_envelope_id_trip_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."trip_envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_component_events" ADD CONSTRAINT "trip_component_events_component_id_trip_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."trip_components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_components" ADD CONSTRAINT "trip_components_envelope_id_trip_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."trip_envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trip_component_events_envelope_time" ON "trip_component_events" USING btree ("envelope_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_trip_component_events_component_time" ON "trip_component_events" USING btree ("component_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_trip_component_events_type_time" ON "trip_component_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_trip_components_envelope_sequence" ON "trip_components" USING btree ("envelope_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_trip_components_envelope_status" ON "trip_components" USING btree ("envelope_id","status");--> statement-breakpoint
CREATE INDEX "idx_trip_components_catalog_entity" ON "trip_components" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE INDEX "idx_trip_components_booking_draft" ON "trip_components" USING btree ("booking_draft_id");--> statement-breakpoint
CREATE INDEX "idx_trip_components_catalog_quote" ON "trip_components" USING btree ("catalog_quote_id");--> statement-breakpoint
CREATE INDEX "idx_trip_components_booking" ON "trip_components" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_trip_components_order" ON "trip_components" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_trip_components_payment_session" ON "trip_components" USING btree ("payment_session_id");--> statement-breakpoint
CREATE INDEX "idx_trip_envelopes_status_updated" ON "trip_envelopes" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_trip_envelopes_created_by_updated" ON "trip_envelopes" USING btree ("created_by","updated_at");--> statement-breakpoint
CREATE INDEX "idx_trip_envelopes_booking_group" ON "trip_envelopes" USING btree ("booking_group_id");--> statement-breakpoint
CREATE INDEX "idx_trip_envelopes_payment_session" ON "trip_envelopes" USING btree ("payment_session_id");--> statement-breakpoint
CREATE INDEX "idx_trip_envelopes_reserve_idempotency" ON "trip_envelopes" USING btree ("reserve_idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_trip_envelopes_checkout_idempotency" ON "trip_envelopes" USING btree ("checkout_idempotency_key");