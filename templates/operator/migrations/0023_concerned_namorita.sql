DO $$ BEGIN
	CREATE TYPE "public"."accommodation_guarantee_mode" AS ENUM('none', 'card_hold', 'deposit', 'full_prepay', 'on_request');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."accommodation_inventory_mode" AS ENUM('pooled', 'serialized', 'virtual');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accommodations_sourced_content" (
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"market" text DEFAULT '*' NOT NULL,
	"payload" jsonb NOT NULL,
	"content_schema_version" text NOT NULL,
	"returned_locale" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fresh_until" timestamp with time zone,
	"etag" text,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetch_error" text,
	CONSTRAINT "accommodations_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_tax_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tax_price_mode" text DEFAULT 'inclusive' NOT NULL,
	"tax_policy_profile_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_tax_settings" ADD COLUMN IF NOT EXISTS "tax_price_mode" text DEFAULT 'inclusive' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_tax_settings" ADD COLUMN IF NOT EXISTS "tax_policy_profile_id" text;--> statement-breakpoint
ALTER TABLE "booking_tax_settings" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_tax_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_payment_defaults" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_payment_policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_payment_instructions" (
	"id" text PRIMARY KEY NOT NULL,
	"bank_transfer_beneficiary" text,
	"iban" text,
	"bank" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"legal_name" text,
	"vat_id" text,
	"registration_number" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"license" text,
	"license_authority" text,
	"signatory_name" text,
	"signatory_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE IF EXISTS "hospitality_sourced_content" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "housekeeping_tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "maintenance_blocks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "room_blocks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "room_unit_status_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "room_units" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_checkpoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_folio_lines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_folios" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_operations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_service_posts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "rate_plan_inventory_overrides" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "room_inventory" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "room_type_rates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_rules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "stay_booking_items" DROP CONSTRAINT IF EXISTS "stay_booking_items_room_unit_id_room_units_id_fk";
--> statement-breakpoint
ALTER TABLE "stay_booking_items" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "stay_booking_items" ALTER COLUMN "status" SET DEFAULT 'reserved'::text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."stay_booking_item_status";--> statement-breakpoint
CREATE TYPE "public"."stay_booking_item_status" AS ENUM('reserved', 'cancelled', 'no_show');--> statement-breakpoint
ALTER TABLE "stay_booking_items" ALTER COLUMN "status" SET DEFAULT 'reserved'::"public"."stay_booking_item_status";--> statement-breakpoint
ALTER TABLE "stay_booking_items" ALTER COLUMN "status" SET DATA TYPE "public"."stay_booking_item_status" USING "status"::"public"."stay_booking_item_status";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_stay_booking_items_room_unit_check_in";--> statement-breakpoint
DROP TABLE IF EXISTS "hospitality_sourced_content" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "housekeeping_tasks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "maintenance_blocks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "room_blocks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "room_unit_status_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "room_units" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stay_checkpoints" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stay_folio_lines" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stay_folios" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stay_operations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stay_service_posts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "rate_plan_inventory_overrides" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "room_inventory" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "room_type_rates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stay_rules" CASCADE;--> statement-breakpoint
ALTER TABLE "rate_plans" ALTER COLUMN "guarantee_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "rate_plans" ALTER COLUMN "guarantee_mode" SET DATA TYPE "public"."accommodation_guarantee_mode" USING "guarantee_mode"::text::"public"."accommodation_guarantee_mode";--> statement-breakpoint
ALTER TABLE "rate_plans" ALTER COLUMN "guarantee_mode" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "room_types" ALTER COLUMN "inventory_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "room_types" ALTER COLUMN "inventory_mode" SET DATA TYPE "public"."accommodation_inventory_mode" USING "inventory_mode"::text::"public"."accommodation_inventory_mode";--> statement-breakpoint
ALTER TABLE "room_types" ALTER COLUMN "inventory_mode" SET DEFAULT 'pooled';--> statement-breakpoint
ALTER TABLE "stay_booking_items" ADD COLUMN IF NOT EXISTS "supplier_room_ref" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accommodations_sourced_content_locale_fresh_idx" ON "accommodations_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accommodations_sourced_content_returned_locale_idx" ON "accommodations_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accommodations_sourced_content_schema_version_idx" ON "accommodations_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
ALTER TABLE "stay_booking_items" DROP COLUMN IF EXISTS "room_unit_id";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."hospitality_guarantee_mode";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."hospitality_housekeeping_task_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."hospitality_inventory_mode";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."hospitality_maintenance_block_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."hospitality_room_block_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."room_unit_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."stay_checkpoint_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."stay_folio_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."stay_operation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."stay_service_post_kind";
