ALTER TABLE "cruise_search_index" ADD COLUMN IF NOT EXISTS "departure_count" integer;
--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN IF NOT EXISTS "lowest_price_cents" integer;
--> statement-breakpoint
UPDATE "cruise_search_index"
SET "lowest_price_cents" = ROUND("lowest_price"::numeric * 100)::integer
WHERE "lowest_price" IS NOT NULL
  AND "lowest_price_cents" IS NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_cruise_search_index_type_price";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cruise_search_index_type_price"
  ON "cruise_search_index" USING btree ("cruise_type", "lowest_price_cents");
--> statement-breakpoint
ALTER TABLE "cruise_search_index" DROP COLUMN IF EXISTS "lowest_price";
