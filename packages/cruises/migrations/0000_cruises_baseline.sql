CREATE TYPE "public"."cruise_air_arrangement" AS ENUM('cruise_line', 'independent', 'none');--> statement-breakpoint
CREATE TYPE "public"."cruise_booking_mode" AS ENUM('inquiry', 'reserve');--> statement-breakpoint
CREATE TYPE "public"."cruise_cabin_room_type" AS ENUM('inside', 'oceanview', 'balcony', 'suite', 'penthouse', 'single');--> statement-breakpoint
CREATE TYPE "public"."cruise_inclusion_kind" AS ENUM('meals', 'drinks', 'gratuities', 'transfers', 'excursions', 'wifi', 'other');--> statement-breakpoint
CREATE TYPE "public"."cruise_media_type" AS ENUM('image', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."cruise_sailing_direction" AS ENUM('upstream', 'downstream', 'round_trip', 'one_way');--> statement-breakpoint
CREATE TYPE "public"."cruise_source" AS ENUM('local', 'external');--> statement-breakpoint
CREATE TYPE "public"."cruise_status" AS ENUM('draft', 'awaiting_review', 'live', 'archived');--> statement-breakpoint
CREATE TYPE "public"."cruise_type" AS ENUM('ocean', 'river', 'expedition', 'coastal');--> statement-breakpoint
CREATE TYPE "public"."cruise_voyage_group_kind" AS ENUM('combination', 'grand_voyage', 'world_cruise', 'cruise_tour');--> statement-breakpoint
CREATE TYPE "public"."cruise_voyage_segment_kind" AS ENUM('cruise', 'land', 'hotel', 'transfer', 'rail', 'air', 'other');--> statement-breakpoint
CREATE TYPE "public"."cruise_voyage_segment_role" AS ENUM('core', 'pre_extension', 'post_extension');--> statement-breakpoint
CREATE TYPE "public"."cruise_enrichment_program_kind" AS ENUM('naturalist', 'historian', 'photographer', 'lecturer', 'expert', 'other');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_availability" AS ENUM('available', 'limited', 'on_request', 'wait_list', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_component_direction" AS ENUM('addition', 'inclusion', 'credit');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_component_kind" AS ENUM('gratuity', 'onboard_credit', 'port_charge', 'tax', 'ncf', 'airfare', 'transfer', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_fare_variant" AS ENUM('cruise_only', 'air_inclusive');--> statement-breakpoint
CREATE TYPE "public"."cruise_sailing_sales_status" AS ENUM('open', 'on_request', 'wait_list', 'sold_out', 'closed');--> statement-breakpoint
CREATE TYPE "public"."cruise_ship_type" AS ENUM('ocean', 'river', 'expedition', 'yacht', 'sailing', 'coastal');--> statement-breakpoint
CREATE TABLE "booking_cruise_details" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"source" "cruise_source" DEFAULT 'local' NOT NULL,
	"source_provider" text,
	"source_ref" jsonb,
	"sailing_id" text,
	"cabin_category_id" text,
	"cabin_id" text,
	"sailing_display_name" text,
	"cabin_display_name" text,
	"occupancy" smallint NOT NULL,
	"fare_code" text,
	"fare_variant" "cruise_price_fare_variant" DEFAULT 'cruise_only' NOT NULL,
	"mode" "cruise_booking_mode" DEFAULT 'inquiry' NOT NULL,
	"quoted_price_per_person" numeric(12, 2) NOT NULL,
	"quoted_total_for_cabin" numeric(12, 2) NOT NULL,
	"quoted_currency" char(3) NOT NULL,
	"quoted_components_json" jsonb DEFAULT '[]'::jsonb,
	"booking_terms_snapshot_json" jsonb,
	"passenger_composition_snapshot_json" jsonb,
	"connector_booking_ref" text,
	"connector_status" text,
	"air_arrangement" "cruise_air_arrangement",
	"linked_flight_booking_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_group_cruise_details" (
	"booking_group_id" text PRIMARY KEY NOT NULL,
	"source" "cruise_source" DEFAULT 'local' NOT NULL,
	"source_provider" text,
	"source_ref" jsonb,
	"sailing_id" text,
	"sailing_display_name" text,
	"cabin_count" smallint NOT NULL,
	"total_quoted_amount" numeric(12, 2) NOT NULL,
	"quoted_currency" char(3) NOT NULL,
	"connector_booking_ref" text,
	"booking_terms_snapshot_json" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruises_sourced_content" (
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
	CONSTRAINT "cruises_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE "cruise_cabin_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"ship_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"room_type" "cruise_cabin_room_type" NOT NULL,
	"description" text,
	"min_occupancy" smallint DEFAULT 1 NOT NULL,
	"max_occupancy" smallint NOT NULL,
	"square_feet" numeric(8, 2),
	"wheelchair_accessible" boolean DEFAULT false NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb,
	"feature_codes" jsonb DEFAULT '[]'::jsonb,
	"bed_configurations" jsonb DEFAULT '[]'::jsonb,
	"accessibility_features" jsonb DEFAULT '[]'::jsonb,
	"view_type" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"floorplan_images" jsonb DEFAULT '[]'::jsonb,
	"grade_codes" jsonb DEFAULT '[]'::jsonb,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"customer_payment_policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_cabins" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"cabin_number" text NOT NULL,
	"deck_id" text,
	"position" text,
	"connects_to" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"ship_id" text NOT NULL,
	"name" text NOT NULL,
	"level" smallint,
	"plan_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_ships" (
	"id" text PRIMARY KEY NOT NULL,
	"line_supplier_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"ship_type" "cruise_ship_type" NOT NULL,
	"capacity_guests" integer,
	"capacity_crew" integer,
	"cabin_count" integer,
	"deck_count" integer,
	"length_meters" numeric(8, 2),
	"cruising_speed_knots" numeric(5, 2),
	"year_built" integer,
	"year_refurbished" integer,
	"imo" text,
	"description" text,
	"deck_plan_url" text,
	"gallery" jsonb DEFAULT '[]'::jsonb,
	"amenities" jsonb DEFAULT '{}'::jsonb,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_enrichment_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"cruise_id" text NOT NULL,
	"kind" "cruise_enrichment_program_kind" NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"bio_image_url" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_inclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"cruise_id" text NOT NULL,
	"kind" "cruise_inclusion_kind" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_media" (
	"id" text PRIMARY KEY NOT NULL,
	"cruise_id" text NOT NULL,
	"sailing_id" text,
	"media_type" "cruise_media_type" NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"mime_type" text,
	"file_size" integer,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_sailings" (
	"id" text PRIMARY KEY NOT NULL,
	"cruise_id" text NOT NULL,
	"ship_id" text NOT NULL,
	"departure_date" date NOT NULL,
	"return_date" date NOT NULL,
	"embark_port_facility_id" text,
	"embark_port_canonical_place_id" text,
	"disembark_port_facility_id" text,
	"disembark_port_canonical_place_id" text,
	"direction" "cruise_sailing_direction",
	"availability_note" text,
	"is_charter" boolean DEFAULT false NOT NULL,
	"sales_status" "cruise_sailing_sales_status" DEFAULT 'open' NOT NULL,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"customer_payment_policy" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_voyage_group_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_group_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"segment_kind" "cruise_voyage_segment_kind" NOT NULL,
	"segment_role" "cruise_voyage_segment_role" DEFAULT 'core' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cruise_id" text,
	"sailing_id" text,
	"start_day" integer,
	"end_day" integer,
	"start_date" date,
	"end_date" date,
	"embark_port_facility_id" text,
	"embark_port_canonical_place_id" text,
	"disembark_port_facility_id" text,
	"disembark_port_canonical_place_id" text,
	"nights" integer,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_voyage_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group_kind" "cruise_voyage_group_kind" NOT NULL,
	"line_supplier_id" text,
	"nights" integer NOT NULL,
	"embark_port_facility_id" text,
	"embark_port_canonical_place_id" text,
	"disembark_port_facility_id" text,
	"disembark_port_canonical_place_id" text,
	"description" text,
	"short_description" text,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"hero_image_url" text,
	"map_image_url" text,
	"status" "cruise_status" DEFAULT 'draft' NOT NULL,
	"lowest_price_cached" numeric(12, 2),
	"lowest_price_currency_cached" text,
	"earliest_departure_cached" date,
	"latest_departure_cached" date,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruises" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cruise_type" "cruise_type" NOT NULL,
	"line_supplier_id" text,
	"default_ship_id" text,
	"nights" integer NOT NULL,
	"embark_port_facility_id" text,
	"embark_port_canonical_place_id" text,
	"disembark_port_facility_id" text,
	"disembark_port_canonical_place_id" text,
	"description" text,
	"short_description" text,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"inclusions_html" text,
	"exclusions_html" text,
	"region_ids" jsonb DEFAULT '[]'::jsonb,
	"waterway_ids" jsonb DEFAULT '[]'::jsonb,
	"port_ids" jsonb DEFAULT '[]'::jsonb,
	"country_iso" jsonb DEFAULT '[]'::jsonb,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"waterways" jsonb DEFAULT '[]'::jsonb,
	"ports" jsonb DEFAULT '[]'::jsonb,
	"countries" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"hero_image_url" text,
	"map_image_url" text,
	"status" "cruise_status" DEFAULT 'draft' NOT NULL,
	"lowest_price_cached" numeric(12, 2),
	"lowest_price_currency_cached" text,
	"earliest_departure_cached" date,
	"latest_departure_cached" date,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"customer_payment_policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_days" (
	"id" text PRIMARY KEY NOT NULL,
	"cruise_id" text NOT NULL,
	"day_number" smallint NOT NULL,
	"title" text,
	"description" text,
	"port_facility_id" text,
	"port_canonical_place_id" text,
	"arrival_time" time,
	"departure_time" time,
	"is_overnight" boolean DEFAULT false NOT NULL,
	"is_sea_day" boolean DEFAULT false NOT NULL,
	"is_expedition_landing" boolean DEFAULT false NOT NULL,
	"meals" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_sailing_days" (
	"id" text PRIMARY KEY NOT NULL,
	"sailing_id" text NOT NULL,
	"day_number" smallint NOT NULL,
	"title" text,
	"description" text,
	"port_facility_id" text,
	"port_canonical_place_id" text,
	"arrival_time" time,
	"departure_time" time,
	"is_overnight" boolean,
	"is_sea_day" boolean,
	"is_expedition_landing" boolean,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"meals" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_price_components" (
	"id" text PRIMARY KEY NOT NULL,
	"price_id" text NOT NULL,
	"kind" "cruise_price_component_kind" NOT NULL,
	"label" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"direction" "cruise_price_component_direction" NOT NULL,
	"per_person" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"sailing_id" text NOT NULL,
	"cabin_category_id" text NOT NULL,
	"occupancy" smallint NOT NULL,
	"fare_code" text,
	"fare_code_name" text,
	"fare_variant" "cruise_price_fare_variant" DEFAULT 'cruise_only' NOT NULL,
	"currency" text NOT NULL,
	"price_per_person" numeric(12, 2) NOT NULL,
	"original_price_per_person" numeric(12, 2),
	"second_guest_price_per_person" numeric(12, 2),
	"single_price_per_person" numeric(12, 2),
	"single_supplement_percent" numeric(5, 2),
	"availability" "cruise_price_availability" DEFAULT 'available' NOT NULL,
	"availability_count" integer,
	"price_catalog_id" text,
	"price_schedule_id" text,
	"booking_deadline" date,
	"early_booking_deadline" date,
	"early_booking_bonus_description" text,
	"requires_request" boolean DEFAULT false NOT NULL,
	"notes" text,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_search_index" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "cruise_source" NOT NULL,
	"source_provider" text,
	"source_ref" jsonb,
	"local_cruise_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cruise_type" "cruise_type" NOT NULL,
	"line_name" text NOT NULL,
	"ship_name" text NOT NULL,
	"nights" integer NOT NULL,
	"embark_port_name" text,
	"embark_port_canonical_place_id" text,
	"disembark_port_name" text,
	"disembark_port_canonical_place_id" text,
	"region_ids" jsonb DEFAULT '[]'::jsonb,
	"waterway_ids" jsonb DEFAULT '[]'::jsonb,
	"port_ids" jsonb DEFAULT '[]'::jsonb,
	"country_iso" jsonb DEFAULT '[]'::jsonb,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"waterways" jsonb DEFAULT '[]'::jsonb,
	"ports" jsonb DEFAULT '[]'::jsonb,
	"countries" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"earliest_departure" date,
	"latest_departure" date,
	"departure_count" integer,
	"lowest_price_cents" integer,
	"lowest_price_currency" char(3),
	"sales_status" text,
	"hero_image_url" text,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cruise_cabin_categories" ADD CONSTRAINT "cruise_cabin_categories_ship_id_cruise_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."cruise_ships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_cabins" ADD CONSTRAINT "cruise_cabins_category_id_cruise_cabin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cruise_cabin_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_cabins" ADD CONSTRAINT "cruise_cabins_deck_id_cruise_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."cruise_decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_decks" ADD CONSTRAINT "cruise_decks_ship_id_cruise_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."cruise_ships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_enrichment_programs" ADD CONSTRAINT "cruise_enrichment_programs_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_inclusions" ADD CONSTRAINT "cruise_inclusions_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_media" ADD CONSTRAINT "cruise_media_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_media" ADD CONSTRAINT "cruise_media_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_sailings" ADD CONSTRAINT "cruise_sailings_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_sailings" ADD CONSTRAINT "cruise_sailings_ship_id_cruise_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."cruise_ships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD CONSTRAINT "cruise_voyage_group_segments_voyage_group_id_cruise_voyage_groups_id_fk" FOREIGN KEY ("voyage_group_id") REFERENCES "public"."cruise_voyage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD CONSTRAINT "cruise_voyage_group_segments_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD CONSTRAINT "cruise_voyage_group_segments_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruises" ADD CONSTRAINT "cruises_default_ship_id_cruise_ships_id_fk" FOREIGN KEY ("default_ship_id") REFERENCES "public"."cruise_ships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_days" ADD CONSTRAINT "cruise_days_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_sailing_days" ADD CONSTRAINT "cruise_sailing_days_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_price_components" ADD CONSTRAINT "cruise_price_components_price_id_cruise_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."cruise_prices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD CONSTRAINT "cruise_prices_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD CONSTRAINT "cruise_prices_cabin_category_id_cruise_cabin_categories_id_fk" FOREIGN KEY ("cabin_category_id") REFERENCES "public"."cruise_cabin_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD CONSTRAINT "cruise_search_index_local_cruise_id_cruises_id_fk" FOREIGN KEY ("local_cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bcd_source" ON "booking_cruise_details" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bcd_sailing" ON "booking_cruise_details" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_bcd_cabin_category" ON "booking_cruise_details" USING btree ("cabin_category_id");--> statement-breakpoint
CREATE INDEX "idx_bcd_connector_ref" ON "booking_cruise_details" USING btree ("connector_booking_ref");--> statement-breakpoint
CREATE INDEX "idx_bcd_provider" ON "booking_cruise_details" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "idx_bcd_air_arrangement" ON "booking_cruise_details" USING btree ("air_arrangement");--> statement-breakpoint
CREATE INDEX "idx_bgcd_source" ON "booking_group_cruise_details" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bgcd_sailing" ON "booking_group_cruise_details" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_bgcd_connector_ref" ON "booking_group_cruise_details" USING btree ("connector_booking_ref");--> statement-breakpoint
CREATE INDEX "idx_bgcd_provider" ON "booking_group_cruise_details" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "cruises_sourced_content_locale_fresh_idx" ON "cruises_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX "cruises_sourced_content_returned_locale_idx" ON "cruises_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX "cruises_sourced_content_schema_version_idx" ON "cruises_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_cabin_categories_ship_code" ON "cruise_cabin_categories" USING btree ("ship_id","code");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_ship_type" ON "cruise_cabin_categories" USING btree ("ship_id","room_type");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_features_gin" ON "cruise_cabin_categories" USING gin ("feature_codes");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_beds_gin" ON "cruise_cabin_categories" USING gin ("bed_configurations");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_accessibility_gin" ON "cruise_cabin_categories" USING gin ("accessibility_features");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_view_type" ON "cruise_cabin_categories" USING btree ("view_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_cabins_category_number" ON "cruise_cabins" USING btree ("category_id","cabin_number");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabins_deck" ON "cruise_cabins" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabins_active" ON "cruise_cabins" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_cruise_decks_ship_level" ON "cruise_decks" USING btree ("ship_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_decks_ship_name" ON "cruise_decks" USING btree ("ship_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_ships_slug" ON "cruise_ships" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_ships_imo" ON "cruise_ships" USING btree ("imo");--> statement-breakpoint
CREATE INDEX "idx_cruise_ships_supplier_active" ON "cruise_ships" USING btree ("line_supplier_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_cruise_ships_type_active" ON "cruise_ships" USING btree ("ship_type","is_active");--> statement-breakpoint
CREATE INDEX "idx_cruise_enrichment_programs_cruise_kind_sort" ON "cruise_enrichment_programs" USING btree ("cruise_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX "idx_cruise_inclusions_cruise_kind_sort" ON "cruise_inclusions" USING btree ("cruise_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX "idx_cruise_media_cruise" ON "cruise_media" USING btree ("cruise_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_media_sailing" ON "cruise_media" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_media_cruise_cover_sort" ON "cruise_media" USING btree ("cruise_id","is_cover","sort_order");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_cruise_departure" ON "cruise_sailings" USING btree ("cruise_id","departure_date");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_ship_departure" ON "cruise_sailings" USING btree ("ship_id","departure_date");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_status_departure" ON "cruise_sailings" USING btree ("sales_status","departure_date");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_embark_place" ON "cruise_sailings" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_disembark_place" ON "cruise_sailings" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_sailings_cruise_date_ship" ON "cruise_sailings" USING btree ("cruise_id","departure_date","ship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_voyage_segments_group_sort" ON "cruise_voyage_group_segments" USING btree ("voyage_group_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_group_role" ON "cruise_voyage_group_segments" USING btree ("voyage_group_id","segment_role");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_cruise" ON "cruise_voyage_group_segments" USING btree ("cruise_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_sailing" ON "cruise_voyage_group_segments" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_embark_place" ON "cruise_voyage_group_segments" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_disembark_place" ON "cruise_voyage_group_segments" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_voyage_groups_slug" ON "cruise_voyage_groups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_kind_status" ON "cruise_voyage_groups" USING btree ("group_kind","status");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_supplier_status" ON "cruise_voyage_groups" USING btree ("line_supplier_id","status");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_embark_place" ON "cruise_voyage_groups" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_disembark_place" ON "cruise_voyage_groups" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_earliest_status" ON "cruise_voyage_groups" USING btree ("earliest_departure_cached","status");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_status_created" ON "cruise_voyage_groups" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruises_slug" ON "cruises" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cruises_type_status" ON "cruises" USING btree ("cruise_type","status");--> statement-breakpoint
CREATE INDEX "idx_cruises_supplier_status" ON "cruises" USING btree ("line_supplier_id","status");--> statement-breakpoint
CREATE INDEX "idx_cruises_embark_place" ON "cruises" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruises_disembark_place" ON "cruises" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruises_region_ids_gin" ON "cruises" USING gin ("region_ids");--> statement-breakpoint
CREATE INDEX "idx_cruises_waterway_ids_gin" ON "cruises" USING gin ("waterway_ids");--> statement-breakpoint
CREATE INDEX "idx_cruises_port_ids_gin" ON "cruises" USING gin ("port_ids");--> statement-breakpoint
CREATE INDEX "idx_cruises_country_iso_gin" ON "cruises" USING gin ("country_iso");--> statement-breakpoint
CREATE INDEX "idx_cruises_waterways_gin" ON "cruises" USING gin ("waterways");--> statement-breakpoint
CREATE INDEX "idx_cruises_ports_gin" ON "cruises" USING gin ("ports");--> statement-breakpoint
CREATE INDEX "idx_cruises_countries_gin" ON "cruises" USING gin ("countries");--> statement-breakpoint
CREATE INDEX "idx_cruises_earliest_departure_status" ON "cruises" USING btree ("earliest_departure_cached","status");--> statement-breakpoint
CREATE INDEX "idx_cruises_status_created" ON "cruises" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_days_cruise_day" ON "cruise_days" USING btree ("cruise_id","day_number");--> statement-breakpoint
CREATE INDEX "idx_cruise_days_cruise" ON "cruise_days" USING btree ("cruise_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_days_port_place" ON "cruise_days" USING btree ("port_canonical_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_sailing_days_sailing_day" ON "cruise_sailing_days" USING btree ("sailing_id","day_number");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailing_days_sailing" ON "cruise_sailing_days" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailing_days_port_place" ON "cruise_sailing_days" USING btree ("port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_price_components_price" ON "cruise_price_components" USING btree ("price_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_price_components_price_kind" ON "cruise_price_components" USING btree ("price_id","kind");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_lookup" ON "cruise_prices" USING btree ("sailing_id","cabin_category_id","occupancy","fare_code","fare_variant");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_lowest" ON "cruise_prices" USING btree ("sailing_id","availability","price_per_person");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_catalog" ON "cruise_prices" USING btree ("price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_schedule" ON "cruise_prices" USING btree ("price_schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_prices_standing" ON "cruise_prices" USING btree ("sailing_id","cabin_category_id","occupancy","fare_code","fare_variant") WHERE "cruise_prices"."price_schedule_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_search_index_slug" ON "cruise_search_index" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_source_refreshed" ON "cruise_search_index" USING btree ("source","refreshed_at");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_type_price" ON "cruise_search_index" USING btree ("cruise_type","lowest_price_cents");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_earliest_departure" ON "cruise_search_index" USING btree ("earliest_departure");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_latest_departure" ON "cruise_search_index" USING btree ("latest_departure");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_embark_place" ON "cruise_search_index" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_disembark_place" ON "cruise_search_index" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_region_ids_gin" ON "cruise_search_index" USING gin ("region_ids");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_waterway_ids_gin" ON "cruise_search_index" USING gin ("waterway_ids");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_port_ids_gin" ON "cruise_search_index" USING gin ("port_ids");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_country_iso_gin" ON "cruise_search_index" USING gin ("country_iso");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_regions_gin" ON "cruise_search_index" USING gin ("regions");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_waterways_gin" ON "cruise_search_index" USING gin ("waterways");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_ports_gin" ON "cruise_search_index" USING gin ("ports");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_countries_gin" ON "cruise_search_index" USING gin ("countries");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_themes_gin" ON "cruise_search_index" USING gin ("themes");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_search_index_external" ON "cruise_search_index" USING btree ("source_provider","source_ref") WHERE "cruise_search_index"."source" = 'external';