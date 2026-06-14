ALTER TABLE "ground_transfer_preferences" DROP CONSTRAINT IF EXISTS "ground_transfer_preferences_pickup_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "ground_transfer_preferences" DROP CONSTRAINT IF EXISTS "ground_transfer_preferences_dropoff_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "ground_execution_events" DROP CONSTRAINT IF EXISTS "ground_execution_events_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "ground_dispatch_legs" DROP CONSTRAINT IF EXISTS "ground_dispatch_legs_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "ground_driver_shifts" DROP CONSTRAINT IF EXISTS "ground_driver_shifts_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "ground_dispatch_checkpoints" DROP CONSTRAINT IF EXISTS "ground_dispatch_checkpoints_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "ground_operators" DROP CONSTRAINT IF EXISTS "ground_operators_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_primary_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "supplier_services" DROP CONSTRAINT IF EXISTS "supplier_services_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "stay_booking_items" DROP CONSTRAINT IF EXISTS "stay_booking_items_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "room_types" DROP CONSTRAINT IF EXISTS "room_types_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "meal_plans" DROP CONSTRAINT IF EXISTS "meal_plans_property_id_properties_id_fk";--> statement-breakpoint
ALTER TABLE "rate_plans" DROP CONSTRAINT IF EXISTS "rate_plans_property_id_properties_id_fk";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_ground_transfer_preferences_pickup_facility_created" ON "ground_transfer_preferences" ("pickup_facility_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ground_transfer_preferences_dropoff_facility_created" ON "ground_transfer_preferences" ("dropoff_facility_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ground_execution_events_facility_occurred_created" ON "ground_execution_events" ("facility_id", "occurred_at", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ground_dispatch_legs_facility_sequence" ON "ground_dispatch_legs" ("facility_id", "sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ground_dispatch_checkpoints_facility_sequence" ON "ground_dispatch_checkpoints" ("facility_id", "sequence");
