CREATE TABLE "booking_catalog_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_provider" text,
	"source_connection_id" text,
	"source_ref" text,
	"frozen_payload" jsonb NOT NULL,
	"overlay_state_at_capture" jsonb,
	"pricing_base_amount" numeric(18, 4),
	"pricing_taxes" numeric(18, 4),
	"pricing_fees" numeric(18, 4),
	"pricing_surcharges" numeric(18, 4),
	"pricing_currency" text,
	"pricing_breakdown" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_overlay" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_path" text NOT NULL,
	"locale" text DEFAULT 'default' NOT NULL,
	"audience" text DEFAULT 'default' NOT NULL,
	"market" text DEFAULT 'default' NOT NULL,
	"value" jsonb NOT NULL,
	"origin" jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_catalog_snapshot_booking_entity_uniq" ON "booking_catalog_snapshot" USING btree ("booking_id","entity_module","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_overlay_variant_uniq" ON "catalog_overlay" USING btree ("entity_module","entity_id","field_path","locale","audience","market") WHERE "catalog_overlay"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "catalog_overlay_entity_idx" ON "catalog_overlay" USING btree ("entity_module","entity_id","deleted_at");--> statement-breakpoint
CREATE INDEX "catalog_overlay_origin_idx" ON "catalog_overlay" USING btree ("origin");