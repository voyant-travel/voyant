CREATE TABLE "catalog_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_provider" text,
	"source_connection_id" text,
	"source_ref" text,
	"available" boolean NOT NULL,
	"invalid_reason" text,
	"locale" text NOT NULL,
	"audience" text NOT NULL,
	"market" text NOT NULL,
	"currency" text,
	"pricing_base_amount" numeric(18, 4),
	"pricing_taxes" numeric(18, 4),
	"pricing_fees" numeric(18, 4),
	"pricing_surcharges" numeric(18, 4),
	"pricing_currency" text,
	"pricing_breakdown" jsonb,
	"upstream_payload" jsonb,
	"consumed_at" timestamp with time zone,
	"consumed_booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_sourced_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_provider" text,
	"source_connection_id" text,
	"source_ref" text,
	"source_freshness" text NOT NULL,
	"last_sourced_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"projection" jsonb NOT NULL,
	"projection_etag" text,
	"projection_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_catalog_quotes_entity" ON "catalog_quotes" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_quotes_expires" ON "catalog_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_catalog_quotes_source" ON "catalog_quotes" USING btree ("source_kind","source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_sourced_entries_entity_uniq" ON "catalog_sourced_entries" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_sourced_entries_source_uniq" ON "catalog_sourced_entries" USING btree ("source_kind","source_connection_id","source_ref");--> statement-breakpoint
CREATE INDEX "catalog_sourced_entries_module_kind_idx" ON "catalog_sourced_entries" USING btree ("entity_module","source_kind");--> statement-breakpoint
CREATE INDEX "catalog_sourced_entries_status_seen_idx" ON "catalog_sourced_entries" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "catalog_sourced_entries_connection_age_idx" ON "catalog_sourced_entries" USING btree ("source_kind","source_connection_id","last_sourced_at");