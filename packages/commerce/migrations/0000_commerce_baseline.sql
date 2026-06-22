DO $$ BEGIN
 CREATE TYPE "public"."fx_rate_source" AS ENUM('manual', 'ecb', 'custom', 'channel', 'supplier', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."market_channel_scope" AS ENUM('all', 'b2c', 'b2b', 'internal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."market_sellability" AS ENUM('sellable', 'on_request', 'unavailable');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."market_status" AS ENUM('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."market_visibility" AS ENUM('public', 'private', 'hidden');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."addon_pricing_mode" AS ENUM('included', 'per_person', 'per_booking', 'on_request', 'unavailable');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cancellation_charge_type" AS ENUM('none', 'amount', 'percentage');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cancellation_policy_type" AS ENUM('simple', 'advanced', 'non_refundable', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."option_pricing_mode" AS ENUM('per_person', 'per_booking', 'starting_from', 'free', 'on_request');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."option_start_time_rule_mode" AS ENUM('included', 'excluded', 'override', 'adjustment');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."option_unit_pricing_mode" AS ENUM('per_unit', 'per_person', 'per_booking', 'included', 'free', 'on_request');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."price_adjustment_type" AS ENUM('fixed', 'percentage');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."price_catalog_type" AS ENUM('public', 'contract', 'net', 'gross', 'promo', 'internal', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."pricing_category_type" AS ENUM('adult', 'child', 'infant', 'senior', 'group', 'room', 'vehicle', 'service', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."pricing_dependency_type" AS ENUM('requires', 'limits_per_master', 'limits_sum', 'excludes');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."promotional_offer_discount_type" AS ENUM('percentage', 'fixed_amount');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."offer_expiration_event_status" AS ENUM('scheduled', 'expired', 'cancelled', 'superseded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."offer_refresh_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sellability_explanation_type" AS ENUM('sellable', 'blocked', 'warning', 'pricing', 'allotment', 'pickup', 'policy');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sellability_policy_result_status" AS ENUM('passed', 'blocked', 'warning', 'adjusted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sellability_policy_scope" AS ENUM('global', 'product', 'option', 'market', 'channel');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sellability_policy_type" AS ENUM('capability', 'occupancy', 'pickup', 'question', 'allotment', 'availability_window', 'currency', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sellability_snapshot_component_kind" AS ENUM('base', 'unit', 'pickup', 'start_time_adjustment');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sellability_snapshot_status" AS ENUM('resolved', 'offer_constructed', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"fx_rate_set_id" text NOT NULL,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"rate_decimal" numeric(18, 8) NOT NULL,
	"inverse_rate_decimal" numeric(18, 8),
	"observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rate_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "fx_rate_source" DEFAULT 'manual' NOT NULL,
	"base_currency" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"observed_at" timestamp with time zone,
	"source_reference" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_channel_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"price_catalog_id" text,
	"visibility" "market_visibility" DEFAULT 'public' NOT NULL,
	"sellability" "market_sellability" DEFAULT 'sellable' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_currencies" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"currency_code" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_settlement" boolean DEFAULT false NOT NULL,
	"is_reporting" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_locales" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_price_catalogs" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"price_catalog_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_product_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"product_id" text NOT NULL,
	"option_id" text,
	"price_catalog_id" text,
	"visibility" "market_visibility" DEFAULT 'public' NOT NULL,
	"sellability" "market_sellability" DEFAULT 'sellable' NOT NULL,
	"channel_scope" "market_channel_scope" DEFAULT 'all' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"available_from" date,
	"available_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "market_status" DEFAULT 'active' NOT NULL,
	"region_code" text,
	"country_code" text,
	"default_language_tag" text NOT NULL,
	"default_currency" text NOT NULL,
	"timezone" text,
	"tax_context" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_catalogs" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"currency_code" text,
	"catalog_type" "price_catalog_type" DEFAULT 'public' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"price_catalog_id" text NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"recurrence_rule" text NOT NULL,
	"timezone" text,
	"valid_from" date,
	"valid_to" date,
	"weekdays" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text,
	"option_id" text,
	"unit_id" text,
	"code" text,
	"name" text NOT NULL,
	"category_type" "pricing_category_type" DEFAULT 'other' NOT NULL,
	"seat_occupancy" integer DEFAULT 1 NOT NULL,
	"group_size" integer,
	"is_age_qualified" boolean DEFAULT false NOT NULL,
	"min_age" integer,
	"max_age" integer,
	"internal_use_only" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_category_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"pricing_category_id" text NOT NULL,
	"master_pricing_category_id" text NOT NULL,
	"dependency_type" "pricing_dependency_type" DEFAULT 'requires' NOT NULL,
	"max_per_master" integer,
	"max_dependent_sum" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departure_price_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"departure_id" text NOT NULL,
	"option_id" text NOT NULL,
	"option_unit_id" text NOT NULL,
	"price_catalog_id" text NOT NULL,
	"sell_amount_cents" integer NOT NULL,
	"cost_amount_cents" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dropoff_price_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"option_price_rule_id" text NOT NULL,
	"option_id" text NOT NULL,
	"facility_id" text,
	"dropoff_code" text,
	"dropoff_name" text NOT NULL,
	"pricing_mode" "addon_pricing_mode" DEFAULT 'included' NOT NULL,
	"sell_amount_cents" integer,
	"cost_amount_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_price_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"option_price_rule_id" text NOT NULL,
	"option_id" text NOT NULL,
	"product_extra_id" text,
	"option_extra_config_id" text,
	"pricing_mode" "addon_pricing_mode" DEFAULT 'included' NOT NULL,
	"sell_amount_cents" integer,
	"cost_amount_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_price_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"option_id" text NOT NULL,
	"price_catalog_id" text NOT NULL,
	"price_schedule_id" text,
	"cancellation_policy_id" text,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"pricing_mode" "option_pricing_mode" DEFAULT 'per_person' NOT NULL,
	"base_sell_amount_cents" integer,
	"base_cost_amount_cents" integer,
	"min_per_booking" integer,
	"max_per_booking" integer,
	"all_pricing_categories" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_start_time_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"option_price_rule_id" text NOT NULL,
	"option_id" text NOT NULL,
	"start_time_id" text NOT NULL,
	"rule_mode" "option_start_time_rule_mode" DEFAULT 'included' NOT NULL,
	"adjustment_type" "price_adjustment_type",
	"sell_adjustment_cents" integer,
	"cost_adjustment_cents" integer,
	"adjustment_basis_points" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_unit_price_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"option_price_rule_id" text NOT NULL,
	"option_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"pricing_category_id" text,
	"pricing_mode" "option_unit_pricing_mode" DEFAULT 'per_unit' NOT NULL,
	"sell_amount_cents" integer,
	"cost_amount_cents" integer,
	"min_quantity" integer,
	"max_quantity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_unit_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"option_unit_price_rule_id" text NOT NULL,
	"min_quantity" integer NOT NULL,
	"max_quantity" integer,
	"sell_amount_cents" integer,
	"cost_amount_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_price_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"option_price_rule_id" text NOT NULL,
	"option_id" text NOT NULL,
	"pickup_point_id" text NOT NULL,
	"pricing_mode" "addon_pricing_mode" DEFAULT 'included' NOT NULL,
	"sell_amount_cents" integer,
	"cost_amount_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellation_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"policy_type" "cancellation_policy_type" DEFAULT 'custom' NOT NULL,
	"simple_cutoff_hours" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellation_policy_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"cancellation_policy_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"cutoff_minutes_before" integer,
	"charge_type" "cancellation_charge_type" DEFAULT 'none' NOT NULL,
	"charge_amount_cents" integer,
	"charge_percent_basis_points" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_offer_products" (
	"offer_id" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "promotional_offer_products_offer_id_product_id_pk" PRIMARY KEY("offer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "promotional_offer_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"code_used" text,
	"discount_applied_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_offer_scheduler_state" (
	"id" text PRIMARY KEY NOT NULL,
	"singleton_key" text DEFAULT 'singleton' NOT NULL,
	"last_tick" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"discount_type" "promotional_offer_discount_type" NOT NULL,
	"discount_percent" numeric(5, 2),
	"discount_amount_cents" integer,
	"currency" text,
	"scope" jsonb NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"code" text,
	"stackable" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_expiration_events" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"snapshot_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"expired_at" timestamp with time zone,
	"status" "offer_expiration_event_status" DEFAULT 'scheduled' NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_refresh_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"snapshot_id" text,
	"status" "offer_refresh_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellability_explanations" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"snapshot_item_id" text,
	"candidate_index" integer DEFAULT 0 NOT NULL,
	"explanation_type" "sellability_explanation_type" DEFAULT 'policy' NOT NULL,
	"code" text,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellability_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" "sellability_policy_scope" DEFAULT 'global' NOT NULL,
	"policy_type" "sellability_policy_type" DEFAULT 'custom' NOT NULL,
	"product_id" text,
	"option_id" text,
	"market_id" text,
	"channel_id" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellability_policy_results" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"snapshot_item_id" text,
	"policy_id" text,
	"candidate_index" integer DEFAULT 0 NOT NULL,
	"status" "sellability_policy_result_status" DEFAULT 'passed' NOT NULL,
	"message" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellability_snapshot_items" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"candidate_index" integer DEFAULT 0 NOT NULL,
	"component_index" integer DEFAULT 0 NOT NULL,
	"product_id" text,
	"option_id" text,
	"slot_id" text,
	"unit_id" text,
	"request_ref" text,
	"component_kind" "sellability_snapshot_component_kind" NOT NULL,
	"title" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"pricing_mode" text NOT NULL,
	"pricing_category_id" text,
	"pricing_category_name" text,
	"unit_name" text,
	"unit_type" text,
	"currency_code" text NOT NULL,
	"sell_amount_cents" integer DEFAULT 0 NOT NULL,
	"cost_amount_cents" integer DEFAULT 0 NOT NULL,
	"source_rule_id" text,
	"tier_id" text,
	"is_selected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellability_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text,
	"market_id" text,
	"channel_id" text,
	"product_id" text,
	"option_id" text,
	"slot_id" text,
	"requested_currency_code" text,
	"source_currency_code" text,
	"fx_rate_set_id" text,
	"status" "sellability_snapshot_status" DEFAULT 'resolved' NOT NULL,
	"query_payload" jsonb NOT NULL,
	"pricing_summary" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_fx_rate_set_id_fx_rate_sets_id_fk" FOREIGN KEY ("fx_rate_set_id") REFERENCES "public"."fx_rate_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_channel_rules" ADD CONSTRAINT "market_channel_rules_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_channel_rules" ADD CONSTRAINT "market_channel_rules_price_catalog_id_market_price_catalogs_id_fk" FOREIGN KEY ("price_catalog_id") REFERENCES "public"."market_price_catalogs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_currencies" ADD CONSTRAINT "market_currencies_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_locales" ADD CONSTRAINT "market_locales_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_price_catalogs" ADD CONSTRAINT "market_price_catalogs_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_product_rules" ADD CONSTRAINT "market_product_rules_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_product_rules" ADD CONSTRAINT "market_product_rules_price_catalog_id_market_price_catalogs_id_fk" FOREIGN KEY ("price_catalog_id") REFERENCES "public"."market_price_catalogs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_schedules" ADD CONSTRAINT "price_schedules_price_catalog_id_price_catalogs_id_fk" FOREIGN KEY ("price_catalog_id") REFERENCES "public"."price_catalogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_category_dependencies" ADD CONSTRAINT "pricing_category_dependencies_pricing_category_id_pricing_categories_id_fk" FOREIGN KEY ("pricing_category_id") REFERENCES "public"."pricing_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_category_dependencies" ADD CONSTRAINT "pricing_category_dependencies_master_pricing_category_id_pricing_categories_id_fk" FOREIGN KEY ("master_pricing_category_id") REFERENCES "public"."pricing_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departure_price_overrides" ADD CONSTRAINT "departure_price_overrides_price_catalog_id_price_catalogs_id_fk" FOREIGN KEY ("price_catalog_id") REFERENCES "public"."price_catalogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dropoff_price_rules" ADD CONSTRAINT "dropoff_price_rules_option_price_rule_id_option_price_rules_id_fk" FOREIGN KEY ("option_price_rule_id") REFERENCES "public"."option_price_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_price_rules" ADD CONSTRAINT "extra_price_rules_option_price_rule_id_option_price_rules_id_fk" FOREIGN KEY ("option_price_rule_id") REFERENCES "public"."option_price_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_price_rules" ADD CONSTRAINT "option_price_rules_price_catalog_id_price_catalogs_id_fk" FOREIGN KEY ("price_catalog_id") REFERENCES "public"."price_catalogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_price_rules" ADD CONSTRAINT "option_price_rules_price_schedule_id_price_schedules_id_fk" FOREIGN KEY ("price_schedule_id") REFERENCES "public"."price_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_price_rules" ADD CONSTRAINT "option_price_rules_cancellation_policy_id_cancellation_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_start_time_rules" ADD CONSTRAINT "option_start_time_rules_option_price_rule_id_option_price_rules_id_fk" FOREIGN KEY ("option_price_rule_id") REFERENCES "public"."option_price_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_unit_price_rules" ADD CONSTRAINT "option_unit_price_rules_option_price_rule_id_option_price_rules_id_fk" FOREIGN KEY ("option_price_rule_id") REFERENCES "public"."option_price_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_unit_price_rules" ADD CONSTRAINT "option_unit_price_rules_pricing_category_id_pricing_categories_id_fk" FOREIGN KEY ("pricing_category_id") REFERENCES "public"."pricing_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_unit_tiers" ADD CONSTRAINT "option_unit_tiers_option_unit_price_rule_id_option_unit_price_rules_id_fk" FOREIGN KEY ("option_unit_price_rule_id") REFERENCES "public"."option_unit_price_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_price_rules" ADD CONSTRAINT "pickup_price_rules_option_price_rule_id_option_price_rules_id_fk" FOREIGN KEY ("option_price_rule_id") REFERENCES "public"."option_price_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_policy_rules" ADD CONSTRAINT "cancellation_policy_rules_cancellation_policy_id_cancellation_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_offer_products" ADD CONSTRAINT "promotional_offer_products_offer_id_promotional_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."promotional_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_offer_redemptions" ADD CONSTRAINT "promotional_offer_redemptions_offer_id_promotional_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."promotional_offers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_expiration_events" ADD CONSTRAINT "offer_expiration_events_snapshot_id_sellability_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sellability_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_refresh_runs" ADD CONSTRAINT "offer_refresh_runs_snapshot_id_sellability_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sellability_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellability_explanations" ADD CONSTRAINT "sellability_explanations_snapshot_id_sellability_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sellability_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellability_explanations" ADD CONSTRAINT "sellability_explanations_snapshot_item_id_sellability_snapshot_items_id_fk" FOREIGN KEY ("snapshot_item_id") REFERENCES "public"."sellability_snapshot_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellability_policy_results" ADD CONSTRAINT "sellability_policy_results_snapshot_id_sellability_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sellability_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellability_policy_results" ADD CONSTRAINT "sellability_policy_results_snapshot_item_id_sellability_snapshot_items_id_fk" FOREIGN KEY ("snapshot_item_id") REFERENCES "public"."sellability_snapshot_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellability_policy_results" ADD CONSTRAINT "sellability_policy_results_policy_id_sellability_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."sellability_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellability_snapshot_items" ADD CONSTRAINT "sellability_snapshot_items_snapshot_id_sellability_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sellability_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_rate_set_created" ON "exchange_rates" USING btree ("fx_rate_set_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_base_currency_created" ON "exchange_rates" USING btree ("base_currency","created_at");--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_quote_currency_created" ON "exchange_rates" USING btree ("quote_currency","created_at");--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_pair" ON "exchange_rates" USING btree ("base_currency","quote_currency");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_exchange_rates_set_pair" ON "exchange_rates" USING btree ("fx_rate_set_id","base_currency","quote_currency");--> statement-breakpoint
CREATE INDEX "idx_fx_rate_sets_base_currency_effective" ON "fx_rate_sets" USING btree ("base_currency","effective_at");--> statement-breakpoint
CREATE INDEX "idx_fx_rate_sets_effective_at" ON "fx_rate_sets" USING btree ("effective_at");--> statement-breakpoint
CREATE INDEX "idx_fx_rate_sets_source_effective" ON "fx_rate_sets" USING btree ("source","effective_at");--> statement-breakpoint
CREATE INDEX "idx_market_channel_rules_market_created" ON "market_channel_rules" USING btree ("market_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_channel_rules_channel_created" ON "market_channel_rules" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_channel_rules_catalog" ON "market_channel_rules" USING btree ("price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_market_channel_rules_sellability_created" ON "market_channel_rules" USING btree ("sellability","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_channel_rules_active_created" ON "market_channel_rules" USING btree ("active","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_currencies_sort_created" ON "market_currencies" USING btree ("sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_currencies_market_sort_created" ON "market_currencies" USING btree ("market_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_currencies_code_sort_created" ON "market_currencies" USING btree ("currency_code","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_currencies_active_sort_created" ON "market_currencies" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_market_currencies_market_code" ON "market_currencies" USING btree ("market_id","currency_code");--> statement-breakpoint
CREATE INDEX "idx_market_locales_sort_created" ON "market_locales" USING btree ("sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_locales_market_sort_created" ON "market_locales" USING btree ("market_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_locales_language_sort_created" ON "market_locales" USING btree ("language_tag","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_locales_active_sort_created" ON "market_locales" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_market_locales_market_language" ON "market_locales" USING btree ("market_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_market_price_catalogs_market_created" ON "market_price_catalogs" USING btree ("market_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_price_catalogs_catalog_created" ON "market_price_catalogs" USING btree ("price_catalog_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_price_catalogs_active_created" ON "market_price_catalogs" USING btree ("active","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_market_price_catalogs_market_catalog" ON "market_price_catalogs" USING btree ("market_id","price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_market_product_rules_market_created" ON "market_product_rules" USING btree ("market_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_product_rules_product_created" ON "market_product_rules" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_product_rules_option_created" ON "market_product_rules" USING btree ("option_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_product_rules_catalog" ON "market_product_rules" USING btree ("price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_market_product_rules_sellability_created" ON "market_product_rules" USING btree ("sellability","created_at");--> statement-breakpoint
CREATE INDEX "idx_market_product_rules_active_created" ON "market_product_rules" USING btree ("active","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_markets_code" ON "markets" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_markets_updated" ON "markets" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_markets_status_updated" ON "markets" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_markets_country_updated" ON "markets" USING btree ("country_code","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_price_catalogs_code" ON "price_catalogs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_price_catalogs_name" ON "price_catalogs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_price_catalogs_currency_name" ON "price_catalogs" USING btree ("currency_code","name");--> statement-breakpoint
CREATE INDEX "idx_price_catalogs_type_name" ON "price_catalogs" USING btree ("catalog_type","name");--> statement-breakpoint
CREATE INDEX "idx_price_catalogs_active_name" ON "price_catalogs" USING btree ("active","name");--> statement-breakpoint
CREATE INDEX "idx_price_schedules_priority_name" ON "price_schedules" USING btree ("priority","name");--> statement-breakpoint
CREATE INDEX "idx_price_schedules_catalog_priority_name" ON "price_schedules" USING btree ("price_catalog_id","priority","name");--> statement-breakpoint
CREATE INDEX "idx_price_schedules_active_priority_name" ON "price_schedules" USING btree ("active","priority","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_price_schedules_catalog_code" ON "price_schedules" USING btree ("price_catalog_id","code");--> statement-breakpoint
CREATE INDEX "idx_pricing_categories_sort_name" ON "pricing_categories" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_pricing_categories_product_sort_name" ON "pricing_categories" USING btree ("product_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_pricing_categories_option_sort_name" ON "pricing_categories" USING btree ("option_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_pricing_categories_unit_sort_name" ON "pricing_categories" USING btree ("unit_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_pricing_categories_type_sort_name" ON "pricing_categories" USING btree ("category_type","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_pricing_categories_active_sort_name" ON "pricing_categories" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pricing_categories_option_code" ON "pricing_categories" USING btree ("option_id","code");--> statement-breakpoint
CREATE INDEX "idx_pricing_category_dependencies_created" ON "pricing_category_dependencies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pricing_category_dependencies_category_created" ON "pricing_category_dependencies" USING btree ("pricing_category_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pricing_category_dependencies_master_created" ON "pricing_category_dependencies" USING btree ("master_pricing_category_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pricing_category_dependencies_type_created" ON "pricing_category_dependencies" USING btree ("dependency_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_pricing_category_dependencies_active_created" ON "pricing_category_dependencies" USING btree ("active","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pricing_category_dependencies_pair_type" ON "pricing_category_dependencies" USING btree ("pricing_category_id","master_pricing_category_id","dependency_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_departure_price_overrides_target" ON "departure_price_overrides" USING btree ("departure_id","option_unit_id","price_catalog_id");--> statement-breakpoint
CREATE INDEX "idx_departure_price_overrides_departure" ON "departure_price_overrides" USING btree ("departure_id","active");--> statement-breakpoint
CREATE INDEX "idx_departure_price_overrides_option" ON "departure_price_overrides" USING btree ("option_id","active");--> statement-breakpoint
CREATE INDEX "idx_departure_price_overrides_catalog" ON "departure_price_overrides" USING btree ("price_catalog_id","active");--> statement-breakpoint
CREATE INDEX "idx_dropoff_price_rules_rule_sort_created" ON "dropoff_price_rules" USING btree ("option_price_rule_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_dropoff_price_rules_option_sort_created" ON "dropoff_price_rules" USING btree ("option_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_dropoff_price_rules_facility_sort_created" ON "dropoff_price_rules" USING btree ("facility_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_dropoff_price_rules_active_sort_created" ON "dropoff_price_rules" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_extra_price_rules_rule_sort_created" ON "extra_price_rules" USING btree ("option_price_rule_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_extra_price_rules_option_sort_created" ON "extra_price_rules" USING btree ("option_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_extra_price_rules_product_extra_sort_created" ON "extra_price_rules" USING btree ("product_extra_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_extra_price_rules_option_extra_config_sort_created" ON "extra_price_rules" USING btree ("option_extra_config_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_extra_price_rules_active_sort_created" ON "extra_price_rules" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_updated" ON "option_price_rules" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_product_updated" ON "option_price_rules" USING btree ("product_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_option_updated" ON "option_price_rules" USING btree ("option_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_catalog_updated" ON "option_price_rules" USING btree ("price_catalog_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_schedule_updated" ON "option_price_rules" USING btree ("price_schedule_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_policy_updated" ON "option_price_rules" USING btree ("cancellation_policy_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_pricing_mode_updated" ON "option_price_rules" USING btree ("pricing_mode","updated_at");--> statement-breakpoint
CREATE INDEX "idx_option_price_rules_active_updated" ON "option_price_rules" USING btree ("active","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_option_price_rules_option_code" ON "option_price_rules" USING btree ("option_id","code");--> statement-breakpoint
CREATE INDEX "idx_option_start_time_rules_created" ON "option_start_time_rules" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_option_start_time_rules_rule_created" ON "option_start_time_rules" USING btree ("option_price_rule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_start_time_rules_option_created" ON "option_start_time_rules" USING btree ("option_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_start_time_rules_start_time_created" ON "option_start_time_rules" USING btree ("start_time_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_start_time_rules_active_created" ON "option_start_time_rules" USING btree ("active","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_option_start_time_rules_rule_start_time" ON "option_start_time_rules" USING btree ("option_price_rule_id","start_time_id");--> statement-breakpoint
CREATE INDEX "idx_option_unit_price_rules_rule_sort_created" ON "option_unit_price_rules" USING btree ("option_price_rule_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_unit_price_rules_option_sort_created" ON "option_unit_price_rules" USING btree ("option_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_unit_price_rules_unit_sort_created" ON "option_unit_price_rules" USING btree ("unit_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_unit_price_rules_category_sort_created" ON "option_unit_price_rules" USING btree ("pricing_category_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_unit_price_rules_active_sort_created" ON "option_unit_price_rules" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_option_unit_tiers_rule_sort_min_quantity" ON "option_unit_tiers" USING btree ("option_unit_price_rule_id","sort_order","min_quantity");--> statement-breakpoint
CREATE INDEX "idx_option_unit_tiers_active_sort_min_quantity" ON "option_unit_tiers" USING btree ("active","sort_order","min_quantity");--> statement-breakpoint
CREATE INDEX "idx_pickup_price_rules_rule_sort_created" ON "pickup_price_rules" USING btree ("option_price_rule_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_pickup_price_rules_option_sort_created" ON "pickup_price_rules" USING btree ("option_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_pickup_price_rules_pickup_sort_created" ON "pickup_price_rules" USING btree ("pickup_point_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_pickup_price_rules_active_sort_created" ON "pickup_price_rules" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pickup_price_rules_rule_pickup" ON "pickup_price_rules" USING btree ("option_price_rule_id","pickup_point_id");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policies_updated" ON "cancellation_policies" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policies_type_updated" ON "cancellation_policies" USING btree ("policy_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policies_active_updated" ON "cancellation_policies" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policies_default_updated" ON "cancellation_policies" USING btree ("is_default","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cancellation_policies_code" ON "cancellation_policies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policy_rules_created" ON "cancellation_policy_rules" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policy_rules_policy_sort_created" ON "cancellation_policy_rules" USING btree ("cancellation_policy_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_cancellation_policy_rules_active_sort_created" ON "cancellation_policy_rules" USING btree ("active","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_pop_product" ON "promotional_offer_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_por_offer" ON "promotional_offer_redemptions" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "idx_por_booking" ON "promotional_offer_redemptions" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_por_offer_booking" ON "promotional_offer_redemptions" USING btree ("offer_id","booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pofs_singleton" ON "promotional_offer_scheduler_state" USING btree ("singleton_key");--> statement-breakpoint
CREATE INDEX "idx_promotional_offers_active_validity" ON "promotional_offers" USING btree ("active","valid_from","valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_promotional_offers_slug_active" ON "promotional_offers" USING btree ("slug") WHERE active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_promotional_offers_code_active" ON "promotional_offers" USING btree (lower(code)) WHERE code is not null and active = true;--> statement-breakpoint
CREATE INDEX "idx_offer_expiration_events_offer_expires" ON "offer_expiration_events" USING btree ("offer_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_offer_expiration_events_snapshot_expires" ON "offer_expiration_events" USING btree ("snapshot_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_offer_expiration_events_status_expires" ON "offer_expiration_events" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_offer_refresh_runs_offer_started" ON "offer_refresh_runs" USING btree ("offer_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_offer_refresh_runs_snapshot_started" ON "offer_refresh_runs" USING btree ("snapshot_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_offer_refresh_runs_status_started" ON "offer_refresh_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_explanations_snapshot_created" ON "sellability_explanations" USING btree ("snapshot_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_explanations_snapshot_item_created" ON "sellability_explanations" USING btree ("snapshot_item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_explanations_type_created" ON "sellability_explanations" USING btree ("explanation_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_priority_name" ON "sellability_policies" USING btree ("priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_scope_priority_name" ON "sellability_policies" USING btree ("scope","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_type_priority_name" ON "sellability_policies" USING btree ("policy_type","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_product_priority_name" ON "sellability_policies" USING btree ("product_id","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_option_priority_name" ON "sellability_policies" USING btree ("option_id","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_market_priority_name" ON "sellability_policies" USING btree ("market_id","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_channel_priority_name" ON "sellability_policies" USING btree ("channel_id","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policies_active_priority_name" ON "sellability_policies" USING btree ("active","priority","name");--> statement-breakpoint
CREATE INDEX "idx_sellability_policy_results_snapshot_created" ON "sellability_policy_results" USING btree ("snapshot_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_policy_results_snapshot_item_created" ON "sellability_policy_results" USING btree ("snapshot_item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_policy_results_policy_created" ON "sellability_policy_results" USING btree ("policy_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_policy_results_status_created" ON "sellability_policy_results" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_snapshot_order" ON "sellability_snapshot_items" USING btree ("snapshot_id","candidate_index","component_index");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_product_order" ON "sellability_snapshot_items" USING btree ("product_id","candidate_index","component_index");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_option_order" ON "sellability_snapshot_items" USING btree ("option_id","candidate_index","component_index");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_slot_order" ON "sellability_snapshot_items" USING btree ("slot_id","candidate_index","component_index");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_unit_order" ON "sellability_snapshot_items" USING btree ("unit_id","candidate_index","component_index");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_candidate" ON "sellability_snapshot_items" USING btree ("candidate_index");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshot_items_component" ON "sellability_snapshot_items" USING btree ("component_kind");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_updated" ON "sellability_snapshots" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_offer_updated" ON "sellability_snapshots" USING btree ("offer_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_market_updated" ON "sellability_snapshots" USING btree ("market_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_channel_updated" ON "sellability_snapshots" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_product_updated" ON "sellability_snapshots" USING btree ("product_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_option_updated" ON "sellability_snapshots" USING btree ("option_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_slot_updated" ON "sellability_snapshots" USING btree ("slot_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sellability_snapshots_status_updated" ON "sellability_snapshots" USING btree ("status","updated_at");