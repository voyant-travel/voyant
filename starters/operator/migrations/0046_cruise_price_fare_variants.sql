CREATE TYPE "public"."cruise_price_fare_variant" AS ENUM('cruise_only', 'air_inclusive');--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD COLUMN "fare_variant" "cruise_price_fare_variant" DEFAULT 'cruise_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD COLUMN "original_price_per_person" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD COLUMN "single_price_per_person" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD COLUMN "early_booking_deadline" date;--> statement-breakpoint
ALTER TABLE "cruise_prices" ADD COLUMN "early_booking_bonus_description" text;--> statement-breakpoint
ALTER TABLE "booking_cruise_details" ADD COLUMN "fare_variant" "cruise_price_fare_variant" DEFAULT 'cruise_only' NOT NULL;--> statement-breakpoint
DROP INDEX "public"."idx_cruise_prices_lookup";--> statement-breakpoint
DROP INDEX "public"."uidx_cruise_prices_standing";--> statement-breakpoint
CREATE INDEX "idx_cruise_prices_lookup" ON "cruise_prices" USING btree ("sailing_id","cabin_category_id","occupancy","fare_code","fare_variant");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_prices_standing" ON "cruise_prices" USING btree ("sailing_id","cabin_category_id","occupancy","fare_code","fare_variant") WHERE "cruise_prices"."price_schedule_id" IS NULL;
