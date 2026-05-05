-- Booking-journey schema additions
-- Per docs/architecture/booking-journey-architecture.md §5.7 + §9.
--
-- Hand-targeted to contain only the booking-journey changes. A
-- `drizzle-kit generate` would also surface pre-existing schema
-- drift from prior commits (rate_limit_buckets, webhook_deliveries,
-- channel_*_push_intents, etc.) that landed without their own
-- migrations — those are out of scope here. A follow-up should run
-- the generator end-to-end and reconcile the snapshot.

-- 1. tax_classes (per-product tax-treatment decision; resolves to a
--    tax_regimes row at quote time)
DO $$ BEGIN
  CREATE TYPE "public"."tax_class_applies_to"
    AS ENUM('base', 'addon', 'accommodation', 'all');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tax_classes" (
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

CREATE INDEX IF NOT EXISTS "idx_tax_classes_code" ON "tax_classes" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_classes_active" ON "tax_classes" ("active");
--> statement-breakpoint

-- 2. products.tax_class_id — plain text (no FK) per schema-discipline
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_class_id" text;
--> statement-breakpoint

-- 3. product_pax_pricing_tiers (per-occupancy rate tiers for non-cruise
--    verticals; cruises keep cruise_prices)
CREATE TABLE IF NOT EXISTS "product_pax_pricing_tiers" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL,
  "option_unit_id" text,
  "tier_pax" integer NOT NULL,
  "price_per_pax_cents" integer NOT NULL,
  "promo_price_per_pax_cents" integer,
  "effective_from" date,
  "effective_to" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_pax_pricing_tiers_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade,
  CONSTRAINT "product_pax_pricing_tiers_option_unit_id_fkey"
    FOREIGN KEY ("option_unit_id") REFERENCES "option_units"("id") ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_pax_tiers_product" ON "product_pax_pricing_tiers" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pax_tiers_unit" ON "product_pax_pricing_tiers" ("option_unit_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_pax_tiers_unit_pax"
  ON "product_pax_pricing_tiers" ("option_unit_id", "tier_pax");
--> statement-breakpoint

-- 4. booking_drafts (resumable journey state, per §5.7)
CREATE TABLE IF NOT EXISTS "booking_drafts" (
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

CREATE INDEX IF NOT EXISTS "idx_booking_drafts_entity"
  ON "booking_drafts" ("entity_module", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_drafts_expires"
  ON "booking_drafts" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_drafts_created_by"
  ON "booking_drafts" ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_drafts_consumed"
  ON "booking_drafts" ("consumed_booking_id");
--> statement-breakpoint

-- 5. booking_catalog_snapshot.idempotency_key (per §12.6)
ALTER TABLE "booking_catalog_snapshot"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "booking_catalog_snapshot_idempotency_uniq"
  ON "booking_catalog_snapshot" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint

-- 6. availability_holds (per booking-journey-architecture §5.7 + §6)
CREATE TABLE IF NOT EXISTS "availability_holds" (
  "id" text PRIMARY KEY NOT NULL,
  "draft_id" text NOT NULL,
  "hold_token" text NOT NULL,
  "product_id" text NOT NULL,
  "slot_id" text NOT NULL,
  "pax_count" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "availability_holds_slot_id_fkey"
    FOREIGN KEY ("slot_id") REFERENCES "availability_slots"("id") ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_availability_holds_slot" ON "availability_holds" ("slot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_availability_holds_draft" ON "availability_holds" ("draft_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_availability_holds_token" ON "availability_holds" ("hold_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_availability_holds_expires" ON "availability_holds" ("expires_at");
--> statement-breakpoint

-- 7. Cruise air-arrangement choice on booking_cruise_details
-- Per booking-journey-architecture §7.
DO $$ BEGIN
  CREATE TYPE "public"."cruise_air_arrangement"
    AS ENUM('cruise_line', 'independent', 'none');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "booking_cruise_details"
  ADD COLUMN IF NOT EXISTS "air_arrangement" "cruise_air_arrangement";
--> statement-breakpoint

ALTER TABLE "booking_cruise_details"
  ADD COLUMN IF NOT EXISTS "linked_flight_booking_id" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_bcd_air_arrangement"
  ON "booking_cruise_details" ("air_arrangement");
