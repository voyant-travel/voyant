DO $$ BEGIN
 CREATE TYPE "public"."accommodation_guarantee_mode" AS ENUM('none', 'card_hold', 'deposit', 'full_prepay', 'on_request');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."accommodation_inventory_mode" AS ENUM('pooled', 'serialized', 'virtual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."rate_plan_charge_frequency" AS ENUM('per_night', 'per_stay', 'per_person_per_night', 'per_person_per_stay');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stay_booking_item_status" AS ENUM('reserved', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "stay_booking_items" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_item_id" text NOT NULL,
	"property_id" text NOT NULL,
	"room_type_id" text NOT NULL,
	"supplier_room_ref" text,
	"rate_plan_id" text NOT NULL,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"night_count" integer DEFAULT 1 NOT NULL,
	"room_count" integer DEFAULT 1 NOT NULL,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"infants" integer DEFAULT 0 NOT NULL,
	"meal_plan_id" text,
	"confirmation_code" text,
	"voucher_code" text,
	"status" "stay_booking_item_status" DEFAULT 'reserved' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stay_daily_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"stay_booking_item_id" text NOT NULL,
	"date" date NOT NULL,
	"sell_currency" text NOT NULL,
	"sell_amount_cents" integer,
	"cost_currency" text,
	"cost_amount_cents" integer,
	"tax_amount_cents" integer,
	"fee_amount_cents" integer,
	"commission_amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"includes_breakfast" boolean DEFAULT false NOT NULL,
	"includes_lunch" boolean DEFAULT false NOT NULL,
	"includes_dinner" boolean DEFAULT false NOT NULL,
	"includes_drinks" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_plan_room_types" (
	"id" text PRIMARY KEY NOT NULL,
	"rate_plan_id" text NOT NULL,
	"room_type_id" text NOT NULL,
	"product_id" text,
	"option_id" text,
	"unit_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meal_plan_id" text,
	"price_catalog_id" text,
	"cancellation_policy_id" text,
	"market_id" text,
	"currency_code" text NOT NULL,
	"charge_frequency" "rate_plan_charge_frequency" DEFAULT 'per_night' NOT NULL,
	"guarantee_mode" "accommodation_guarantee_mode" DEFAULT 'none' NOT NULL,
	"commissionable" boolean DEFAULT true NOT NULL,
	"refundable" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"customer_payment_policy" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_type_bed_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"room_type_id" text NOT NULL,
	"bed_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"supplier_id" text,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"inventory_mode" "accommodation_inventory_mode" DEFAULT 'pooled' NOT NULL,
	"room_class" text,
	"max_adults" integer,
	"max_children" integer,
	"max_infants" integer,
	"standard_occupancy" integer,
	"max_occupancy" integer,
	"min_occupancy" integer,
	"bedroom_count" integer,
	"bathroom_count" integer,
	"area_value" integer,
	"area_unit" text,
	"accessibility_notes" text,
	"smoking_allowed" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accommodations_sourced_content" (
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
ALTER TABLE "stay_booking_items" ADD CONSTRAINT "stay_booking_items_booking_item_id_booking_items_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_booking_items" ADD CONSTRAINT "stay_booking_items_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_booking_items" ADD CONSTRAINT "stay_booking_items_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_booking_items" ADD CONSTRAINT "stay_booking_items_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_daily_rates" ADD CONSTRAINT "stay_daily_rates_stay_booking_item_id_stay_booking_items_id_fk" FOREIGN KEY ("stay_booking_item_id") REFERENCES "public"."stay_booking_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_room_types" ADD CONSTRAINT "rate_plan_room_types_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_room_types" ADD CONSTRAINT "rate_plan_room_types_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_bed_configs" ADD CONSTRAINT "room_type_bed_configs_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stay_booking_items_booking_item" ON "stay_booking_items" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_stay_booking_items_check_in" ON "stay_booking_items" USING btree ("check_in_date");--> statement-breakpoint
CREATE INDEX "idx_stay_booking_items_property_check_in" ON "stay_booking_items" USING btree ("property_id","check_in_date");--> statement-breakpoint
CREATE INDEX "idx_stay_booking_items_room_type_check_in" ON "stay_booking_items" USING btree ("room_type_id","check_in_date");--> statement-breakpoint
CREATE INDEX "idx_stay_booking_items_rate_plan_check_in" ON "stay_booking_items" USING btree ("rate_plan_id","check_in_date");--> statement-breakpoint
CREATE INDEX "idx_stay_booking_items_status_check_in" ON "stay_booking_items" USING btree ("status","check_in_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_stay_booking_items_booking_item" ON "stay_booking_items" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_stay_daily_rates_stay_booking_item" ON "stay_daily_rates" USING btree ("stay_booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_stay_daily_rates_date" ON "stay_daily_rates" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_stay_daily_rates_item_date" ON "stay_daily_rates" USING btree ("stay_booking_item_id","date");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_property_sort_name" ON "meal_plans" USING btree ("property_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_active_sort_name" ON "meal_plans" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_meal_plans_property_code" ON "meal_plans" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_room_types_rate_plan_sort_created" ON "rate_plan_room_types" USING btree ("rate_plan_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_room_types_room_type_sort_created" ON "rate_plan_room_types" USING btree ("room_type_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_room_types_product_sort_created" ON "rate_plan_room_types" USING btree ("product_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_room_types_option" ON "rate_plan_room_types" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_room_types_unit" ON "rate_plan_room_types" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_room_types_active_sort_created" ON "rate_plan_room_types" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_rate_plan_room_types_pair" ON "rate_plan_room_types" USING btree ("rate_plan_id","room_type_id");--> statement-breakpoint
CREATE INDEX "idx_rate_plans_property_sort_name" ON "rate_plans" USING btree ("property_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_rate_plans_meal_plan_sort_name" ON "rate_plans" USING btree ("meal_plan_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_rate_plans_catalog" ON "rate_plans" USING btree ("price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_rate_plans_policy" ON "rate_plans" USING btree ("cancellation_policy_id");--> statement-breakpoint
CREATE INDEX "idx_rate_plans_market_sort_name" ON "rate_plans" USING btree ("market_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_rate_plans_active_sort_name" ON "rate_plans" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_rate_plans_property_code" ON "rate_plans" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "idx_room_type_bed_configs_room_type_primary_created" ON "room_type_bed_configs" USING btree ("room_type_id","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_room_type_bed_configs_bed_type_primary_created" ON "room_type_bed_configs" USING btree ("bed_type","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_room_types_property_sort_name" ON "room_types" USING btree ("property_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_room_types_supplier_sort_name" ON "room_types" USING btree ("supplier_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_room_types_active_sort_name" ON "room_types" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_room_types_inventory_mode_sort_name" ON "room_types" USING btree ("inventory_mode","sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_room_types_property_code" ON "room_types" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "accommodations_sourced_content_locale_fresh_idx" ON "accommodations_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX "accommodations_sourced_content_returned_locale_idx" ON "accommodations_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX "accommodations_sourced_content_schema_version_idx" ON "accommodations_sourced_content" USING btree ("content_schema_version");