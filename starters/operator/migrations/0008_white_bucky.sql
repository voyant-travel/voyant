ALTER TABLE "booking_catalog_snapshot" ADD COLUMN "pricing_applied_offers" jsonb;--> statement-breakpoint
ALTER TABLE "catalog_quotes" ADD COLUMN "pricing_applied_offers" jsonb;--> statement-breakpoint
CREATE INDEX "idx_catalog_quotes_consumed_booking" ON "catalog_quotes" USING btree ("consumed_booking_id");