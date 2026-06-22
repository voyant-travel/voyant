CREATE TABLE "booking_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_connection_id" text,
	"source_ref" text,
	"draft_payload" jsonb NOT NULL,
	"current_step" text,
	"current_quote_id" text,
	"hold_expires_at" timestamp with time zone,
	"consumed_booking_id" text,
	"consumed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_catalog_snapshot" ADD COLUMN "pricing_applied_offers" jsonb;--> statement-breakpoint
ALTER TABLE "booking_catalog_snapshot" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "catalog_quotes" ADD COLUMN "pricing_applied_offers" jsonb;--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_entity" ON "booking_drafts" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_expires" ON "booking_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_created_by" ON "booking_drafts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_booking_drafts_consumed" ON "booking_drafts" USING btree ("consumed_booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_catalog_snapshot_idempotency_uniq" ON "booking_catalog_snapshot" USING btree ("idempotency_key") WHERE idempotency_key is not null;--> statement-breakpoint
CREATE INDEX "idx_catalog_quotes_consumed_booking" ON "catalog_quotes" USING btree ("consumed_booking_id");