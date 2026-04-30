CREATE TYPE "public"."cruise_booking_mode" AS ENUM('inquiry', 'reserve');--> statement-breakpoint
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
	"mode" "cruise_booking_mode" DEFAULT 'inquiry' NOT NULL,
	"quoted_price_per_person" numeric(12, 2) NOT NULL,
	"quoted_total_for_cabin" numeric(12, 2) NOT NULL,
	"quoted_currency" char(3) NOT NULL,
	"quoted_components_json" jsonb DEFAULT '[]'::jsonb,
	"connector_booking_ref" text,
	"connector_status" text,
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
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_bcd_source" ON "booking_cruise_details" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bcd_sailing" ON "booking_cruise_details" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_bcd_cabin_category" ON "booking_cruise_details" USING btree ("cabin_category_id");--> statement-breakpoint
CREATE INDEX "idx_bcd_connector_ref" ON "booking_cruise_details" USING btree ("connector_booking_ref");--> statement-breakpoint
CREATE INDEX "idx_bcd_provider" ON "booking_cruise_details" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "idx_bgcd_source" ON "booking_group_cruise_details" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bgcd_sailing" ON "booking_group_cruise_details" USING btree ("sailing_id");--> statement-breakpoint
CREATE INDEX "idx_bgcd_connector_ref" ON "booking_group_cruise_details" USING btree ("connector_booking_ref");--> statement-breakpoint
CREATE INDEX "idx_bgcd_provider" ON "booking_group_cruise_details" USING btree ("source_provider");