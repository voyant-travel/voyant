CREATE TABLE "booking_origins" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"origin_source" text DEFAULT 'manual' NOT NULL,
	"quote_version_id" text,
	"trip_snapshot_id" text,
	"reservation_plan_id" text,
	"catalog_price_response_id" text,
	"catalog_snapshot_id" text,
	"provider_source_kind" text,
	"provider_source_provider" text,
	"provider_source_connection_id" text,
	"provider_source_ref" text,
	"provider_order_ref" text,
	"legacy_transaction_offer_id" text,
	"legacy_transaction_order_id" text,
	"legacy_transaction_ids" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_booking_origins_source" CHECK ("booking_origins"."origin_source" IN ('manual', 'direct_b2c', 'accepted_quote_version', 'catalog_price_availability', 'catalog_snapshot', 'provider_source_order', 'legacy_transaction'))
);
--> statement-breakpoint
ALTER TABLE "booking_origins" ADD CONSTRAINT "booking_origins_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "booking_origins" (
	"booking_id",
	"origin_source",
	"legacy_transaction_offer_id",
	"legacy_transaction_order_id",
	"provider_source_ref",
	"legacy_transaction_ids",
	"created_at",
	"updated_at"
)
SELECT
	"booking_id",
	'legacy_transaction',
	"offer_id",
	"order_id",
	COALESCE("order_id", "offer_id"),
	jsonb_strip_nulls(jsonb_build_object('offerId', "offer_id", 'orderId', "order_id")),
	"created_at",
	"updated_at"
FROM "booking_transaction_details"
ON CONFLICT ("booking_id") DO NOTHING;
--> statement-breakpoint
CREATE INDEX "idx_booking_origins_quote_version" ON "booking_origins" USING btree ("quote_version_id");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_trip_snapshot" ON "booking_origins" USING btree ("trip_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_catalog_price_response" ON "booking_origins" USING btree ("catalog_price_response_id");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_catalog_snapshot" ON "booking_origins" USING btree ("catalog_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_provider_order" ON "booking_origins" USING btree ("provider_order_ref");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_legacy_offer" ON "booking_origins" USING btree ("legacy_transaction_offer_id");--> statement-breakpoint
CREATE INDEX "idx_booking_origins_legacy_order" ON "booking_origins" USING btree ("legacy_transaction_order_id");
