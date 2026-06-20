CREATE TYPE "public"."charter_booking_mode" AS ENUM('per_suite', 'whole_yacht');--> statement-breakpoint
CREATE TYPE "public"."charter_source" AS ENUM('local', 'external');--> statement-breakpoint
CREATE TYPE "public"."charter_status" AS ENUM('draft', 'awaiting_review', 'live', 'archived');--> statement-breakpoint
CREATE TYPE "public"."charter_suite_availability" AS ENUM('available', 'limited', 'on_request', 'wait_list', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."charter_suite_category" AS ENUM('standard', 'deluxe', 'suite', 'penthouse', 'owners', 'signature');--> statement-breakpoint
CREATE TYPE "public"."charter_voyage_sales_status" AS ENUM('open', 'on_request', 'wait_list', 'sold_out', 'closed');--> statement-breakpoint
CREATE TYPE "public"."charter_yacht_class" AS ENUM('luxury_motor', 'luxury_sailing', 'expedition', 'small_cruise');--> statement-breakpoint
CREATE TABLE "booking_charter_details" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"booking_mode" charter_booking_mode NOT NULL,
	"source" charter_source DEFAULT 'local' NOT NULL,
	"source_provider" text,
	"source_ref" jsonb,
	"voyage_id" text,
	"suite_id" text,
	"yacht_id" text,
	"voyage_display_name" text,
	"suite_display_name" text,
	"yacht_name" text,
	"charter_area_snapshot" text,
	"guest_count" smallint NOT NULL,
	"quoted_currency" char(3) NOT NULL,
	"quoted_suite_price" numeric(12, 2),
	"quoted_port_fee" numeric(12, 2),
	"quoted_charter_fee" numeric(15, 2),
	"apa_percent" numeric(5, 2),
	"apa_amount" numeric(15, 2),
	"quoted_total" numeric(15, 2) NOT NULL,
	"myba_template_id_snapshot" text,
	"myba_contract_id" text,
	"apa_paid_amount" numeric(15, 2) DEFAULT '0.00',
	"apa_spent_amount" numeric(15, 2) DEFAULT '0.00',
	"apa_refund_amount" numeric(15, 2) DEFAULT '0.00',
	"apa_settled_at" timestamp with time zone,
	"connector_booking_ref" text,
	"connector_status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charters_sourced_content" (
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
	CONSTRAINT "charters_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE "charter_products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"line_supplier_id" text,
	"default_yacht_id" text,
	"description" text,
	"short_description" text,
	"hero_image_url" text,
	"map_image_url" text,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"status" charter_status DEFAULT 'draft' NOT NULL,
	"default_booking_modes" jsonb DEFAULT '["per_suite"]'::jsonb,
	"default_myba_template_id" text,
	"default_apa_percent" numeric(5, 2),
	"lowest_price_cached_amount" numeric(12, 2),
	"lowest_price_cached_currency" text,
	"earliest_voyage_cached" date,
	"latest_voyage_cached" date,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charter_voyages" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"yacht_id" text NOT NULL,
	"voyage_code" text NOT NULL,
	"name" text,
	"embark_port_facility_id" text,
	"embark_port_name" text,
	"disembark_port_facility_id" text,
	"disembark_port_name" text,
	"departure_date" date NOT NULL,
	"return_date" date NOT NULL,
	"nights" smallint NOT NULL,
	"booking_modes" jsonb DEFAULT '["per_suite"]'::jsonb NOT NULL,
	"appointment_only" boolean DEFAULT false NOT NULL,
	"whole_yacht_prices_by_currency" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"apa_percent_override" numeric(5, 2),
	"myba_template_id_override" text,
	"charter_area_override" text,
	"sales_status" charter_voyage_sales_status DEFAULT 'open' NOT NULL,
	"availability_note" text,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charter_schedule_days" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"day_number" smallint NOT NULL,
	"port_facility_id" text,
	"port_name" text,
	"schedule_date" date,
	"arrival_time" time,
	"departure_time" time,
	"is_sea_day" boolean DEFAULT false NOT NULL,
	"description" text,
	"activities" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charter_suites" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_id" text NOT NULL,
	"suite_code" text NOT NULL,
	"suite_name" text NOT NULL,
	"suite_category" charter_suite_category,
	"description" text,
	"square_feet" numeric(8, 2),
	"images" jsonb DEFAULT '[]'::jsonb,
	"floorplan_images" jsonb DEFAULT '[]'::jsonb,
	"max_guests" smallint,
	"prices_by_currency" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"port_fees_by_currency" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"availability" charter_suite_availability DEFAULT 'available' NOT NULL,
	"units_available" smallint,
	"appointment_only" boolean DEFAULT false NOT NULL,
	"notes" text,
	"extra" jsonb DEFAULT '{}'::jsonb,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charter_yachts" (
	"id" text PRIMARY KEY NOT NULL,
	"line_supplier_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"yacht_class" charter_yacht_class NOT NULL,
	"capacity_guests" integer,
	"capacity_crew" integer,
	"length_meters" numeric(8, 2),
	"year_built" integer,
	"year_refurbished" integer,
	"imo" text,
	"description" text,
	"gallery" jsonb DEFAULT '[]'::jsonb,
	"amenities" jsonb DEFAULT '{}'::jsonb,
	"crew_bios" jsonb DEFAULT '[]'::jsonb,
	"default_charter_areas" jsonb DEFAULT '[]'::jsonb,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charter_products" ADD CONSTRAINT "charter_products_default_yacht_id_charter_yachts_id_fk" FOREIGN KEY ("default_yacht_id") REFERENCES "public"."charter_yachts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_voyages" ADD CONSTRAINT "charter_voyages_product_id_charter_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."charter_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_voyages" ADD CONSTRAINT "charter_voyages_yacht_id_charter_yachts_id_fk" FOREIGN KEY ("yacht_id") REFERENCES "public"."charter_yachts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_schedule_days" ADD CONSTRAINT "charter_schedule_days_voyage_id_charter_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."charter_voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_suites" ADD CONSTRAINT "charter_suites_voyage_id_charter_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."charter_voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bchd_mode" ON "booking_charter_details" USING btree ("booking_mode");--> statement-breakpoint
CREATE INDEX "idx_bchd_source" ON "booking_charter_details" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bchd_voyage" ON "booking_charter_details" USING btree ("voyage_id");--> statement-breakpoint
CREATE INDEX "idx_bchd_suite" ON "booking_charter_details" USING btree ("suite_id");--> statement-breakpoint
CREATE INDEX "idx_bchd_yacht" ON "booking_charter_details" USING btree ("yacht_id");--> statement-breakpoint
CREATE INDEX "idx_bchd_myba_contract" ON "booking_charter_details" USING btree ("myba_contract_id");--> statement-breakpoint
CREATE INDEX "idx_bchd_connector_ref" ON "booking_charter_details" USING btree ("connector_booking_ref");--> statement-breakpoint
CREATE INDEX "idx_bchd_provider" ON "booking_charter_details" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "charters_sourced_content_locale_fresh_idx" ON "charters_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX "charters_sourced_content_returned_locale_idx" ON "charters_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX "charters_sourced_content_schema_version_idx" ON "charters_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_charter_products_slug" ON "charter_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_charter_products_status_created" ON "charter_products" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_charter_products_supplier_status" ON "charter_products" USING btree ("line_supplier_id","status");--> statement-breakpoint
CREATE INDEX "idx_charter_products_earliest" ON "charter_products" USING btree ("earliest_voyage_cached","status");--> statement-breakpoint
CREATE INDEX "idx_charter_voyages_product_departure" ON "charter_voyages" USING btree ("product_id","departure_date");--> statement-breakpoint
CREATE INDEX "idx_charter_voyages_yacht_departure" ON "charter_voyages" USING btree ("yacht_id","departure_date");--> statement-breakpoint
CREATE INDEX "idx_charter_voyages_status_departure" ON "charter_voyages" USING btree ("sales_status","departure_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_charter_voyages_product_date_yacht" ON "charter_voyages" USING btree ("product_id","departure_date","yacht_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_charter_schedule_voyage_day" ON "charter_schedule_days" USING btree ("voyage_id","day_number");--> statement-breakpoint
CREATE INDEX "idx_charter_schedule_voyage" ON "charter_schedule_days" USING btree ("voyage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_charter_suites_voyage_code" ON "charter_suites" USING btree ("voyage_id","suite_code");--> statement-breakpoint
CREATE INDEX "idx_charter_suites_voyage_availability" ON "charter_suites" USING btree ("voyage_id","availability");--> statement-breakpoint
CREATE INDEX "idx_charter_suites_voyage_category" ON "charter_suites" USING btree ("voyage_id","suite_category");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_charter_yachts_slug" ON "charter_yachts" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_charter_yachts_imo" ON "charter_yachts" USING btree ("imo");--> statement-breakpoint
CREATE INDEX "idx_charter_yachts_supplier_active" ON "charter_yachts" USING btree ("line_supplier_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_charter_yachts_class_active" ON "charter_yachts" USING btree ("yacht_class","is_active");