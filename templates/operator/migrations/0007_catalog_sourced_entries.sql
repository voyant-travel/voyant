CREATE TABLE IF NOT EXISTS "extras_sourced_content" (
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"market" text DEFAULT '*' NOT NULL,
	"payload" jsonb NOT NULL,
	"content_schema_version" text NOT NULL,
	"returned_locale" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fresh_until" timestamp with time zone,
	"etag" text,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetch_error" text,
	CONSTRAINT "extras_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products_sourced_content" (
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"market" text DEFAULT '*' NOT NULL,
	"payload" jsonb NOT NULL,
	"content_schema_version" text NOT NULL,
	"returned_locale" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fresh_until" timestamp with time zone,
	"etag" text,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetch_error" text,
	CONSTRAINT "products_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cruises_sourced_content" (
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"market" text DEFAULT '*' NOT NULL,
	"payload" jsonb NOT NULL,
	"content_schema_version" text NOT NULL,
	"returned_locale" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fresh_until" timestamp with time zone,
	"etag" text,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetch_error" text,
	CONSTRAINT "cruises_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "charters_sourced_content" (
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"market" text DEFAULT '*' NOT NULL,
	"payload" jsonb NOT NULL,
	"content_schema_version" text NOT NULL,
	"returned_locale" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fresh_until" timestamp with time zone,
	"etag" text,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetch_error" text,
	CONSTRAINT "charters_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hospitality_sourced_content" (
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"market" text DEFAULT '*' NOT NULL,
	"payload" jsonb NOT NULL,
	"content_schema_version" text NOT NULL,
	"returned_locale" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fresh_until" timestamp with time zone,
	"etag" text,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetch_error" text,
	CONSTRAINT "hospitality_sourced_content_entity_id_locale_market_pk" PRIMARY KEY("entity_id","locale","market")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog_quotes" (
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
CREATE TABLE IF NOT EXISTS "catalog_sourced_entries" (
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
ALTER TABLE "product_extras" ADD COLUMN IF NOT EXISTS "supplier_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_id" text;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN IF NOT EXISTS "supplier_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extras_sourced_content_locale_fresh_idx" ON "extras_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extras_sourced_content_returned_locale_idx" ON "extras_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extras_sourced_content_schema_version_idx" ON "extras_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_sourced_content_locale_fresh_idx" ON "products_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_sourced_content_returned_locale_idx" ON "products_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_sourced_content_schema_version_idx" ON "products_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cruises_sourced_content_locale_fresh_idx" ON "cruises_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cruises_sourced_content_returned_locale_idx" ON "cruises_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cruises_sourced_content_schema_version_idx" ON "cruises_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "charters_sourced_content_locale_fresh_idx" ON "charters_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "charters_sourced_content_returned_locale_idx" ON "charters_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "charters_sourced_content_schema_version_idx" ON "charters_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospitality_sourced_content_locale_fresh_idx" ON "hospitality_sourced_content" USING btree ("locale","fresh_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospitality_sourced_content_returned_locale_idx" ON "hospitality_sourced_content" USING btree ("entity_id","returned_locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospitality_sourced_content_schema_version_idx" ON "hospitality_sourced_content" USING btree ("content_schema_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_catalog_quotes_entity" ON "catalog_quotes" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_catalog_quotes_expires" ON "catalog_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_catalog_quotes_source" ON "catalog_quotes" USING btree ("source_kind","source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_sourced_entries_entity_uniq" ON "catalog_sourced_entries" USING btree ("entity_module","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_sourced_entries_source_uniq" ON "catalog_sourced_entries" USING btree ("source_kind","source_connection_id","source_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_sourced_entries_module_kind_idx" ON "catalog_sourced_entries" USING btree ("entity_module","source_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_sourced_entries_status_seen_idx" ON "catalog_sourced_entries" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_sourced_entries_connection_age_idx" ON "catalog_sourced_entries" USING btree ("source_kind","source_connection_id","last_sourced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_extras_supplier_sort_name" ON "product_extras" USING btree ("supplier_id","sort_order","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_supplier" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_supplier_created" ON "products" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_room_types_supplier_sort_name" ON "room_types" USING btree ("supplier_id","sort_order","name");