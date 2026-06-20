DO $$ BEGIN
 CREATE TYPE "public"."extra_collection_mode" AS ENUM('booking_total', 'cash_on_trip', 'external', 'included', 'none');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."extra_pricing_mode" AS ENUM('included', 'per_person', 'per_booking', 'quantity_based', 'on_request', 'free');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."extra_selection_type" AS ENUM('optional', 'required', 'default_selected', 'unavailable');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."option_unit_type" AS ENUM('person', 'group', 'room', 'vehicle', 'service', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_activation_mode" AS ENUM('manual', 'scheduled', 'channel_controlled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_booking_mode" AS ENUM('date', 'date_time', 'open', 'stay', 'transfer', 'itinerary', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_capability" AS ENUM('instant_confirmation', 'on_request', 'pickup_available', 'dropoff_available', 'guided', 'private', 'shared', 'digital_ticket', 'voucher_required', 'external_inventory', 'multi_day', 'accommodation', 'transport');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_capacity_mode" AS ENUM('free_sale', 'limited', 'on_request');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_delivery_format" AS ENUM('voucher', 'ticket', 'pdf', 'qr_code', 'barcode', 'email', 'mobile', 'none');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_feature_type" AS ENUM('inclusion', 'exclusion', 'highlight', 'important_information', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_location_type" AS ENUM('start', 'end', 'meeting_point', 'pickup', 'dropoff', 'point_of_interest', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_media_type" AS ENUM('image', 'video', 'document');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_option_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_ticket_fulfillment" AS ENUM('none', 'per_booking', 'per_participant', 'per_item');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_visibility" AS ENUM('public', 'private', 'hidden');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."service_type" AS ENUM('accommodation', 'transfer', 'experience', 'guide', 'meal', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "booking_item_product_details" (
	"booking_item_id" text PRIMARY KEY NOT NULL,
	"product_id" text,
	"option_id" text,
	"unit_id" text,
	"supplier_service_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_product_details" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"product_id" text,
	"option_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products_sourced_content" (
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
	CONSTRAINT "products_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE "extras_sourced_content" (
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
	CONSTRAINT "extras_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE "option_extra_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"option_id" text NOT NULL,
	"product_extra_id" text NOT NULL,
	"selection_type" "extra_selection_type",
	"pricing_mode" "extra_pricing_mode",
	"priced_per_person" boolean,
	"min_quantity" integer,
	"max_quantity" integer,
	"default_quantity" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_extras" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"supplier_id" text,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"selection_type" "extra_selection_type" DEFAULT 'optional' NOT NULL,
	"pricing_mode" "extra_pricing_mode" DEFAULT 'per_booking' NOT NULL,
	"priced_per_person" boolean DEFAULT false NOT NULL,
	"collection_mode" "extra_collection_mode" DEFAULT 'booking_total' NOT NULL,
	"show_on_slot_manifest" boolean DEFAULT true NOT NULL,
	"min_quantity" integer,
	"max_quantity" integer,
	"default_quantity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_units" (
	"id" text PRIMARY KEY NOT NULL,
	"option_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"unit_type" "option_unit_type" DEFAULT 'person' NOT NULL,
	"min_quantity" integer,
	"max_quantity" integer,
	"min_age" integer,
	"max_age" integer,
	"occupancy_min" integer,
	"occupancy_max" integer,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"status" "product_option_status" DEFAULT 'draft' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"available_from" date,
	"available_to" date,
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
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"inclusions_html" text,
	"exclusions_html" text,
	"terms_html" text,
	"terms_show_on_contract" boolean DEFAULT false NOT NULL,
	"booking_mode" "product_booking_mode" DEFAULT 'date' NOT NULL,
	"capacity_mode" "product_capacity_mode" DEFAULT 'limited' NOT NULL,
	"timezone" text,
	"default_language_tag" text,
	"visibility" "product_visibility" DEFAULT 'private' NOT NULL,
	"activated" boolean DEFAULT false NOT NULL,
	"reservation_timeout_minutes" integer,
	"sell_currency" text NOT NULL,
	"sell_amount_cents" integer,
	"cost_amount_cents" integer,
	"margin_percent" integer,
	"facility_id" text,
	"supplier_id" text,
	"start_date" date,
	"end_date" date,
	"pax" integer,
	"product_type_id" text,
	"contract_template_id" text,
	"tax_class_id" text,
	"customer_payment_policy" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_day_services" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"supplier_service_id" text,
	"service_type" "service_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"country_code" text,
	"cost_currency" text NOT NULL,
	"cost_amount_cents" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_day_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"title" text,
	"description" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_days" (
	"id" text PRIMARY KEY NOT NULL,
	"itinerary_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"title" text,
	"description" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_itineraries" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"day_id" text,
	"media_type" "product_media_type" NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"mime_type" text,
	"file_size" integer,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"is_brochure" boolean DEFAULT false NOT NULL,
	"is_brochure_current" boolean DEFAULT false NOT NULL,
	"brochure_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"author_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_unit_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_activation_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"activation_mode" "product_activation_mode" DEFAULT 'manual' NOT NULL,
	"activate_at" timestamp with time zone,
	"deactivate_at" timestamp with time zone,
	"sell_at" timestamp with time zone,
	"stop_sell_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_capabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"capability" "product_capability" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_delivery_formats" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"format" "product_delivery_format" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_faqs" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_features" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"feature_type" "product_feature_type" DEFAULT 'highlight' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"location_type" "product_location_type" DEFAULT 'point_of_interest' NOT NULL,
	"title" text NOT NULL,
	"address" text,
	"city" text,
	"country_code" text,
	"latitude" double precision,
	"longitude" double precision,
	"google_place_id" text,
	"apple_place_id" text,
	"tripadvisor_location_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_option_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"option_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_ticket_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"fulfillment_mode" "product_ticket_fulfillment" DEFAULT 'none' NOT NULL,
	"default_delivery_format" "product_delivery_format" DEFAULT 'none' NOT NULL,
	"ticket_per_unit" boolean DEFAULT false NOT NULL,
	"barcode_format" text,
	"voucher_message" text,
	"ticket_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"inclusions_html" text,
	"exclusions_html" text,
	"terms_html" text,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_visibility_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"is_searchable" boolean DEFAULT false NOT NULL,
	"is_bookable" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"requires_authentication" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destination_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"destination_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"code" text,
	"canonical_place_id" text,
	"destination_type" text DEFAULT 'destination' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"customer_payment_policy" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_category_products" (
	"product_id" text NOT NULL,
	"category_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_category_products_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_category_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_destinations" (
	"product_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_destinations_product_id_destination_id_pk" PRIMARY KEY("product_id","destination_id")
);
--> statement-breakpoint
CREATE TABLE "product_tag_products" (
	"product_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_tag_products_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "product_tag_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "option_extra_configs" ADD CONSTRAINT "option_extra_configs_product_extra_id_product_extras_id_fk" FOREIGN KEY ("product_extra_id") REFERENCES "public"."product_extras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_units" ADD CONSTRAINT "option_units_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pax_pricing_tiers" ADD CONSTRAINT "product_pax_pricing_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pax_pricing_tiers" ADD CONSTRAINT "product_pax_pricing_tiers_option_unit_id_option_units_id_fk" FOREIGN KEY ("option_unit_id") REFERENCES "public"."option_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_day_services" ADD CONSTRAINT "product_day_services_day_id_product_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."product_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_day_translations" ADD CONSTRAINT "product_day_translations_day_id_product_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."product_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_days" ADD CONSTRAINT "product_days_itinerary_id_product_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."product_itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_itineraries" ADD CONSTRAINT "product_itineraries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_day_id_product_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."product_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_notes" ADD CONSTRAINT "product_notes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_unit_translations" ADD CONSTRAINT "option_unit_translations_unit_id_option_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."option_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_activation_settings" ADD CONSTRAINT "product_activation_settings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_capabilities" ADD CONSTRAINT "product_capabilities_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_delivery_formats" ADD CONSTRAINT "product_delivery_formats_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_faqs" ADD CONSTRAINT "product_faqs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_features" ADD CONSTRAINT "product_features_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_translations" ADD CONSTRAINT "product_option_translations_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ticket_settings" ADD CONSTRAINT "product_ticket_settings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_visibility_settings" ADD CONSTRAINT "product_visibility_settings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_translations" ADD CONSTRAINT "destination_translations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_products" ADD CONSTRAINT "product_category_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_products" ADD CONSTRAINT "product_category_products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_translations" ADD CONSTRAINT "product_category_translations_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_destinations" ADD CONSTRAINT "product_destinations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_destinations" ADD CONSTRAINT "product_destinations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_products" ADD CONSTRAINT "product_tag_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_products" ADD CONSTRAINT "product_tag_products_tag_id_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_translations" ADD CONSTRAINT "product_tag_translations_tag_id_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bipd_product" ON "booking_item_product_details" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_bipd_option" ON "booking_item_product_details" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_bipd_unit" ON "booking_item_product_details" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_bipd_supplier_service" ON "booking_item_product_details" USING btree ("supplier_service_id");--> statement-breakpoint
CREATE INDEX "idx_bpd_product" ON "booking_product_details" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_bpd_option" ON "booking_product_details" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "products_sourced_content_locale_fresh_idx" ON "products_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX "products_sourced_content_returned_locale_idx" ON "products_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX "products_sourced_content_schema_version_idx" ON "products_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX "extras_sourced_content_locale_fresh_idx" ON "extras_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX "extras_sourced_content_returned_locale_idx" ON "extras_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX "extras_sourced_content_schema_version_idx" ON "extras_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX "idx_option_extra_configs_sort_default" ON "option_extra_configs" USING btree ("sort_order","is_default");--> statement-breakpoint
CREATE INDEX "idx_option_extra_configs_option_sort_default" ON "option_extra_configs" USING btree ("option_id","sort_order","is_default");--> statement-breakpoint
CREATE INDEX "idx_option_extra_configs_extra_sort_default" ON "option_extra_configs" USING btree ("product_extra_id","sort_order","is_default");--> statement-breakpoint
CREATE INDEX "idx_option_extra_configs_active_sort_default" ON "option_extra_configs" USING btree ("active","sort_order","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_option_extra_configs_option_extra" ON "option_extra_configs" USING btree ("option_id","product_extra_id");--> statement-breakpoint
CREATE INDEX "idx_product_extras_sort_name" ON "product_extras" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_extras_product_sort_name" ON "product_extras" USING btree ("product_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_extras_supplier_sort_name" ON "product_extras" USING btree ("supplier_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_extras_active_sort_name" ON "product_extras" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_extras_product_code" ON "product_extras" USING btree ("product_id","code");--> statement-breakpoint
CREATE INDEX "idx_option_units_option" ON "option_units" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_option_units_option_sort" ON "option_units" USING btree ("option_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_units_type" ON "option_units" USING btree ("unit_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_option_units_option_code" ON "option_units" USING btree ("option_id","code");--> statement-breakpoint
CREATE INDEX "idx_product_options_product" ON "product_options" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_options_product_sort" ON "product_options" USING btree ("product_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_options_status" ON "product_options" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_product_options_default" ON "product_options" USING btree ("is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_options_product_code" ON "product_options" USING btree ("product_id","code");--> statement-breakpoint
CREATE INDEX "idx_pax_tiers_product" ON "product_pax_pricing_tiers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pax_tiers_unit" ON "product_pax_pricing_tiers" USING btree ("option_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pax_tiers_unit_pax" ON "product_pax_pricing_tiers" USING btree ("option_unit_id","tier_pax");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_products_facility" ON "products" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "idx_products_supplier" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_products_product_type" ON "products" USING btree ("product_type_id");--> statement-breakpoint
CREATE INDEX "idx_products_contract_template" ON "products" USING btree ("contract_template_id");--> statement-breakpoint
CREATE INDEX "idx_products_status_created" ON "products" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_booking_mode_created" ON "products" USING btree ("booking_mode","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_capacity_mode_created" ON "products" USING btree ("capacity_mode","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_visibility_created" ON "products" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_activated_created" ON "products" USING btree ("activated","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_facility_created" ON "products" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_supplier_created" ON "products" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_product_type_created" ON "products" USING btree ("product_type_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_public_created" ON "products" USING btree ("status","activated","visibility","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_products_description_trgm" ON "products" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_day_services_day" ON "product_day_services" USING btree ("day_id");--> statement-breakpoint
CREATE INDEX "idx_product_day_services_day_sort" ON "product_day_services" USING btree ("day_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_product_day_services_supplier_service" ON "product_day_services" USING btree ("supplier_service_id");--> statement-breakpoint
CREATE INDEX "idx_product_day_translations_day" ON "product_day_translations" USING btree ("day_id");--> statement-breakpoint
CREATE INDEX "idx_product_day_translations_language" ON "product_day_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_day_translations_day_language" ON "product_day_translations" USING btree ("day_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_days_itinerary" ON "product_days" USING btree ("itinerary_id");--> statement-breakpoint
CREATE INDEX "idx_product_days_itinerary_day_number" ON "product_days" USING btree ("itinerary_id","day_number");--> statement-breakpoint
CREATE INDEX "idx_product_itineraries_product" ON "product_itineraries" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_itineraries_product_sort" ON "product_itineraries" USING btree ("product_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_itineraries_product_default" ON "product_itineraries" USING btree ("product_id","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_itineraries_default" ON "product_itineraries" USING btree ("product_id") WHERE "product_itineraries"."is_default" = true;--> statement-breakpoint
CREATE INDEX "idx_product_media_product" ON "product_media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_media_day" ON "product_media" USING btree ("day_id");--> statement-breakpoint
CREATE INDEX "idx_product_media_product_day" ON "product_media" USING btree ("product_id","day_id");--> statement-breakpoint
CREATE INDEX "idx_product_media_product_cover_sort" ON "product_media" USING btree ("product_id","is_cover","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_media_product_day_cover_sort" ON "product_media" USING btree ("product_id","day_id","is_cover","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_media_product_brochure_current_version" ON "product_media" USING btree ("product_id","is_brochure","day_id","is_brochure_current","brochure_version","updated_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_notes_product" ON "product_notes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_notes_product_created" ON "product_notes" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_versions_product" ON "product_versions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_versions_product_version" ON "product_versions" USING btree ("product_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_option_unit_translations_unit" ON "option_unit_translations" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_option_unit_translations_language" ON "option_unit_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_option_unit_translations_unit_language_created" ON "option_unit_translations" USING btree ("unit_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_unit_translations_language_created" ON "option_unit_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_option_unit_translations_unit_language" ON "option_unit_translations" USING btree ("unit_id","language_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_activation_settings_product" ON "product_activation_settings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_activation_settings_created" ON "product_activation_settings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_product_activation_settings_mode" ON "product_activation_settings" USING btree ("activation_mode");--> statement-breakpoint
CREATE INDEX "idx_product_activation_settings_mode_created" ON "product_activation_settings" USING btree ("activation_mode","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_capabilities_product" ON "product_capabilities" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_capabilities_capability" ON "product_capabilities" USING btree ("capability");--> statement-breakpoint
CREATE INDEX "idx_product_capabilities_capability_created" ON "product_capabilities" USING btree ("capability","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_capabilities_enabled_capability_created" ON "product_capabilities" USING btree ("enabled","capability","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_capabilities_product_capability" ON "product_capabilities" USING btree ("product_id","capability");--> statement-breakpoint
CREATE INDEX "idx_product_delivery_formats_product" ON "product_delivery_formats" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_delivery_formats_default_created" ON "product_delivery_formats" USING btree ("is_default","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_delivery_formats_product_default_created" ON "product_delivery_formats" USING btree ("product_id","is_default","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_delivery_formats_format_default_created" ON "product_delivery_formats" USING btree ("format","is_default","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_delivery_formats_product_format" ON "product_delivery_formats" USING btree ("product_id","format");--> statement-breakpoint
CREATE INDEX "idx_product_faqs_product" ON "product_faqs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_faqs_sort" ON "product_faqs" USING btree ("sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_faqs_product_sort" ON "product_faqs" USING btree ("product_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_features_product" ON "product_features" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_features_sort" ON "product_features" USING btree ("sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_features_product_sort" ON "product_features" USING btree ("product_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_features_type" ON "product_features" USING btree ("feature_type");--> statement-breakpoint
CREATE INDEX "idx_product_features_type_sort" ON "product_features" USING btree ("feature_type","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_features_product_type_sort" ON "product_features" USING btree ("product_id","feature_type","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_locations_product" ON "product_locations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_locations_sort" ON "product_locations" USING btree ("sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_locations_product_sort" ON "product_locations" USING btree ("product_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_locations_type" ON "product_locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX "idx_product_locations_type_product" ON "product_locations" USING btree ("location_type","product_id");--> statement-breakpoint
CREATE INDEX "idx_product_locations_type_sort" ON "product_locations" USING btree ("location_type","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_locations_product_type_sort" ON "product_locations" USING btree ("product_id","location_type","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_locations_country_product" ON "product_locations" USING btree ("country_code","product_id");--> statement-breakpoint
CREATE INDEX "idx_product_locations_title_trgm" ON "product_locations" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_locations_city_trgm" ON "product_locations" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_option_translations_option" ON "product_option_translations" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_product_option_translations_language" ON "product_option_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_option_translations_option_language_created" ON "product_option_translations" USING btree ("option_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_option_translations_language_created" ON "product_option_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_option_translations_option_language" ON "product_option_translations" USING btree ("option_id","language_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_ticket_settings_product" ON "product_ticket_settings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_ticket_settings_created" ON "product_ticket_settings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_product_ticket_settings_fulfillment_created" ON "product_ticket_settings" USING btree ("fulfillment_mode","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_translations_product" ON "product_translations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_translations_language" ON "product_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_translations_product_language_created" ON "product_translations" USING btree ("product_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_translations_language_created" ON "product_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_translations_product_language" ON "product_translations" USING btree ("product_id","language_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_visibility_settings_product" ON "product_visibility_settings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_visibility_settings_created" ON "product_visibility_settings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_product_visibility_settings_searchable_created" ON "product_visibility_settings" USING btree ("is_searchable","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_visibility_settings_bookable_created" ON "product_visibility_settings" USING btree ("is_bookable","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_visibility_settings_featured_product" ON "product_visibility_settings" USING btree ("is_featured","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_destination_translations_locale" ON "destination_translations" USING btree ("destination_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_destination_translations_language" ON "destination_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_destination_translations_destination_language_created" ON "destination_translations" USING btree ("destination_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_destination_translations_language_created" ON "destination_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_destination_translations_name_trgm" ON "destination_translations" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_destination_translations_description_trgm" ON "destination_translations" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_destinations_slug" ON "destinations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_destinations_code" ON "destinations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_destinations_parent" ON "destinations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_destinations_active" ON "destinations" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_destinations_canonical_place" ON "destinations" USING btree ("canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_destinations_sort_slug" ON "destinations" USING btree ("sort_order","slug");--> statement-breakpoint
CREATE INDEX "idx_destinations_active_sort_slug" ON "destinations" USING btree ("active","sort_order","slug");--> statement-breakpoint
CREATE INDEX "idx_destinations_type_sort_slug" ON "destinations" USING btree ("destination_type","sort_order","slug");--> statement-breakpoint
CREATE INDEX "idx_destinations_parent_sort_slug" ON "destinations" USING btree ("parent_id","sort_order","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_categories_slug" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_product_categories_parent" ON "product_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_product_categories_active" ON "product_categories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_product_categories_sort_name" ON "product_categories" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_categories_active_sort_name" ON "product_categories" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_categories_parent_sort_name" ON "product_categories" USING btree ("parent_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_categories_name_trgm" ON "product_categories" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_categories_slug_trgm" ON "product_categories" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_pcp_product_sort" ON "product_category_products" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_pcp_category" ON "product_category_products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_category_translations_locale" ON "product_category_translations" USING btree ("category_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_category_translations_language" ON "product_category_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_category_translations_category_language_created" ON "product_category_translations" USING btree ("category_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_category_translations_language_created" ON "product_category_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_destinations_product_sort" ON "product_destinations" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_product_destinations_destination_sort" ON "product_destinations" USING btree ("destination_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_ptp_tag" ON "product_tag_products" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_tag_translations_locale" ON "product_tag_translations" USING btree ("tag_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_tag_translations_language" ON "product_tag_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_tag_translations_tag_language_created" ON "product_tag_translations" USING btree ("tag_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_tag_translations_language_created" ON "product_tag_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_tags_name" ON "product_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_product_tags_name_trgm" ON "product_tags" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_types_code" ON "product_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_product_types_active" ON "product_types" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_product_types_sort_name" ON "product_types" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_product_types_active_sort_name" ON "product_types" USING btree ("active","sort_order","name");