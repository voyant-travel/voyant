CREATE TYPE "public"."voucher_source_type" AS ENUM('refund', 'cancellation_credit', 'gift', 'manual', 'promo');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('active', 'redeemed', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."cruise_cabin_room_type" AS ENUM('inside', 'oceanview', 'balcony', 'suite', 'penthouse', 'single');--> statement-breakpoint
CREATE TYPE "public"."cruise_inclusion_kind" AS ENUM('meals', 'drinks', 'gratuities', 'transfers', 'excursions', 'wifi', 'other');--> statement-breakpoint
CREATE TYPE "public"."cruise_media_type" AS ENUM('image', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."cruise_sailing_direction" AS ENUM('upstream', 'downstream', 'round_trip', 'one_way');--> statement-breakpoint
CREATE TYPE "public"."cruise_source" AS ENUM('local', 'external');--> statement-breakpoint
CREATE TYPE "public"."cruise_status" AS ENUM('draft', 'awaiting_review', 'live', 'archived');--> statement-breakpoint
CREATE TYPE "public"."cruise_type" AS ENUM('ocean', 'river', 'expedition', 'coastal');--> statement-breakpoint
CREATE TYPE "public"."cruise_enrichment_program_kind" AS ENUM('naturalist', 'historian', 'photographer', 'lecturer', 'expert', 'other');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_availability" AS ENUM('available', 'limited', 'on_request', 'wait_list', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_component_direction" AS ENUM('addition', 'inclusion', 'credit');--> statement-breakpoint
CREATE TYPE "public"."cruise_price_component_kind" AS ENUM('gratuity', 'onboard_credit', 'port_charge', 'tax', 'ncf', 'airfare', 'transfer', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."cruise_sailing_sales_status" AS ENUM('open', 'on_request', 'wait_list', 'sold_out', 'closed');--> statement-breakpoint
CREATE TYPE "public"."cruise_ship_type" AS ENUM('ocean', 'river', 'expedition', 'yacht', 'sailing', 'coastal');--> statement-breakpoint
ALTER TYPE "public"."channel_kind" ADD VALUE 'connect';--> statement-breakpoint
ALTER TYPE "public"."booking_group_kind" ADD VALUE 'cruise_party' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."booking_activity_type" ADD VALUE 'booking_started' BEFORE 'hold_extended';--> statement-breakpoint
ALTER TYPE "public"."booking_activity_type" ADD VALUE 'booking_completed' BEFORE 'hold_extended';--> statement-breakpoint
ALTER TYPE "public"."booking_activity_type" ADD VALUE 'status_overridden' BEFORE 'item_update';--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"body_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "voucher_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"voucher_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"payment_id" text,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"series_code" text,
	"status" "voucher_status" DEFAULT 'active' NOT NULL,
	"currency" text NOT NULL,
	"initial_amount_cents" integer NOT NULL,
	"remaining_amount_cents" integer NOT NULL,
	"issued_to_person_id" text,
	"issued_to_organization_id" text,
	"source_type" "voucher_source_type" NOT NULL,
	"source_booking_id" text,
	"source_payment_id" text,
	"valid_from" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"notes" text,
	"issued_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"images" jsonb DEFAULT '[]'::jsonb,
	"floorplan_images" jsonb DEFAULT '[]'::jsonb,
	"grade_codes" jsonb DEFAULT '[]'::jsonb,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
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
	"disembark_port_facility_id" text,
	"direction" "cruise_sailing_direction",
	"availability_note" text,
	"is_charter" boolean DEFAULT false NOT NULL,
	"sales_status" "cruise_sailing_sales_status" DEFAULT 'open' NOT NULL,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp with time zone,
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
	"disembark_port_facility_id" text,
	"description" text,
	"short_description" text,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"inclusions_html" text,
	"exclusions_html" text,
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
CREATE TABLE "cruise_days" (
	"id" text PRIMARY KEY NOT NULL,
	"cruise_id" text NOT NULL,
	"day_number" smallint NOT NULL,
	"title" text,
	"description" text,
	"port_facility_id" text,
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
	"currency" text NOT NULL,
	"price_per_person" numeric(12, 2) NOT NULL,
	"second_guest_price_per_person" numeric(12, 2),
	"single_supplement_percent" numeric(5, 2),
	"availability" "cruise_price_availability" DEFAULT 'available' NOT NULL,
	"availability_count" integer,
	"price_catalog_id" text,
	"price_schedule_id" text,
	"booking_deadline" date,
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
	"disembark_port_name" text,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"earliest_departure" date,
	"latest_departure" date,
	"lowest_price" numeric(12, 2),
	"lowest_price_currency" char(3),
	"sales_status" text,
	"hero_image_url" text,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "fx_rate_set_id" text;--> statement-breakpoint
ALTER TABLE "booking_traveler_travel_details" ADD COLUMN "accessibility_encrypted" jsonb;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "cruises" ADD CONSTRAINT "cruises_default_ship_id_cruise_ships_id_fk" FOREIGN KEY ("default_ship_id") REFERENCES "public"."cruise_ships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_days" ADD CONSTRAINT "cruise_days_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_sailing_days" ADD CONSTRAINT "cruise_sailing_days_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_price_components" ADD CONSTRAINT "cruise_price_components_price_id_cruise_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."cruise_prices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD CONSTRAINT "cruise_prices_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD CONSTRAINT "cruise_prices_cabin_category_id_cruise_cabin_categories_id_fk" FOREIGN KEY ("cabin_category_id") REFERENCES "public"."cruise_cabin_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD CONSTRAINT "cruise_search_index_local_cruise_id_cruises_id_fk" FOREIGN KEY ("local_cruise_id") REFERENCES "public"."cruises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_infra_idempotency_keys_scope_key" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "idx_infra_idempotency_keys_expires_at" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemptions_voucher" ON "voucher_redemptions" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemptions_booking" ON "voucher_redemptions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemptions_voucher_created" ON "voucher_redemptions" USING btree ("voucher_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_vouchers_code" ON "vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_vouchers_series" ON "vouchers" USING btree ("series_code");--> statement-breakpoint
CREATE INDEX "idx_vouchers_status" ON "vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vouchers_person" ON "vouchers" USING btree ("issued_to_person_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_organization" ON "vouchers" USING btree ("issued_to_organization_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_source_booking" ON "vouchers" USING btree ("source_booking_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_valid_from" ON "vouchers" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "idx_vouchers_expires_at" ON "vouchers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_vouchers_remaining" ON "vouchers" USING btree ("remaining_amount_cents");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_cabin_categories_ship_code" ON "cruise_cabin_categories" USING btree ("ship_id","code");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_ship_type" ON "cruise_cabin_categories" USING btree ("ship_id","room_type");--> statement-breakpoint
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
CREATE UNIQUE INDEX "uidx_cruise_sailings_cruise_date_ship" ON "cruise_sailings" USING btree ("cruise_id","departure_date","ship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruises_slug" ON "cruises" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cruises_type_status" ON "cruises" USING btree ("cruise_type","status");--> statement-breakpoint
CREATE INDEX "idx_cruises_supplier_status" ON "cruises" USING btree ("line_supplier_id","status");--> statement-breakpoint
CREATE INDEX "idx_cruises_earliest_departure_status" ON "cruises" USING btree ("earliest_departure_cached","status");--> statement-breakpoint
CREATE INDEX "idx_cruises_status_created" ON "cruises" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_days_cruise_day" ON "cruise_days" USING btree ("cruise_id","day_number");--> statement-breakpoint
CREATE INDEX "idx_cruise_days_cruise" ON "cruise_days" USING btree ("cruise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_sailing_days_sailing_day" ON "cruise_sailing_days" USING btree ("sailing_id","day_number");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailing_days_sailing" ON "cruise_sailing_days" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_price_components_price" ON "cruise_price_components" USING btree ("price_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_price_components_price_kind" ON "cruise_price_components" USING btree ("price_id","kind");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_lookup" ON "cruise_prices" USING btree ("sailing_id","cabin_category_id","occupancy","fare_code");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_lowest" ON "cruise_prices" USING btree ("sailing_id","availability","price_per_person");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_catalog" ON "cruise_prices" USING btree ("price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_schedule" ON "cruise_prices" USING btree ("price_schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_prices_standing" ON "cruise_prices" USING btree ("sailing_id","cabin_category_id","occupancy","fare_code") WHERE "cruise_prices"."price_schedule_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_search_index_slug" ON "cruise_search_index" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_source_refreshed" ON "cruise_search_index" USING btree ("source","refreshed_at");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_type_price" ON "cruise_search_index" USING btree ("cruise_type","lowest_price");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_earliest_departure" ON "cruise_search_index" USING btree ("earliest_departure");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_latest_departure" ON "cruise_search_index" USING btree ("latest_departure");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_regions_gin" ON "cruise_search_index" USING gin ("regions");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_themes_gin" ON "cruise_search_index" USING gin ("themes");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_search_index_external" ON "cruise_search_index" USING btree ("source_provider",("source_ref"->>'externalId')) WHERE "cruise_search_index"."source" = 'external';--> statement-breakpoint
ALTER TABLE "booking_travelers" DROP COLUMN "accessibility_needs";--> statement-breakpoint
ALTER TABLE "offer_items" ADD CONSTRAINT "ck_offer_items_cost_currency_amounts" CHECK (("offer_items"."unit_cost_amount_cents" IS NULL AND "offer_items"."total_cost_amount_cents" IS NULL) OR "offer_items"."cost_currency" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_cost_currency_amounts" CHECK (("order_items"."unit_cost_amount_cents" IS NULL AND "order_items"."total_cost_amount_cents" IS NULL) OR "order_items"."cost_currency" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "ck_bookings_base_currency_amounts" CHECK (("bookings"."base_sell_amount_cents" IS NULL AND "bookings"."base_cost_amount_cents" IS NULL) OR "bookings"."base_currency" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "ck_booking_items_cost_currency_amounts" CHECK (("booking_items"."unit_cost_amount_cents" IS NULL AND "booking_items"."total_cost_amount_cents" IS NULL) OR "booking_items"."cost_currency" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "booking_guarantees" ADD CONSTRAINT "ck_booking_guarantees_currency_amount" CHECK (("booking_guarantees"."currency" IS NULL) = ("booking_guarantees"."amount_cents" IS NULL));--> statement-breakpoint
ALTER TABLE "booking_item_commissions" ADD CONSTRAINT "ck_booking_item_commissions_currency_amount" CHECK (("booking_item_commissions"."currency" IS NULL) = ("booking_item_commissions"."amount_cents" IS NULL));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_base_currency_amounts" CHECK ((
        "invoices"."base_subtotal_cents" IS NULL
        AND "invoices"."base_tax_cents" IS NULL
        AND "invoices"."base_total_cents" IS NULL
        AND "invoices"."base_paid_cents" IS NULL
        AND "invoices"."base_balance_due_cents" IS NULL
      ) OR "invoices"."base_currency" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "ck_payments_base_currency_amount" CHECK (("payments"."base_currency" IS NULL) = ("payments"."base_amount_cents" IS NULL));