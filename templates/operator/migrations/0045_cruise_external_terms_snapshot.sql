ALTER TABLE "booking_cruise_details"
  ADD COLUMN IF NOT EXISTS "booking_terms_snapshot_json" jsonb,
  ADD COLUMN IF NOT EXISTS "passenger_composition_snapshot_json" jsonb;
--> statement-breakpoint
ALTER TABLE "booking_group_cruise_details"
  ADD COLUMN IF NOT EXISTS "booking_terms_snapshot_json" jsonb;
--> statement-breakpoint
DROP INDEX IF EXISTS "uidx_cruise_search_index_external";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_cruise_search_index_external"
  ON "cruise_search_index" USING btree ("source_provider", "source_ref")
  WHERE "cruise_search_index"."source" = 'external';
