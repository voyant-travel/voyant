ALTER TABLE "catalog_overlay" ADD COLUMN IF NOT EXISTS "node_kind" text DEFAULT 'root' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_overlay" ADD COLUMN IF NOT EXISTS "node_key" text DEFAULT 'root' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_overlay" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_overlay" ADD COLUMN IF NOT EXISTS "editorial_note" text;--> statement-breakpoint
DROP INDEX IF EXISTS "catalog_overlay_variant_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_overlay_variant_uniq" ON "catalog_overlay" USING btree ("entity_module","entity_id","node_kind","node_key","field_path","locale","audience","market") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog_overlay_history" (
	"id" text PRIMARY KEY NOT NULL,
	"overlay_id" text,
	"entity_module" text NOT NULL,
	"entity_id" text NOT NULL,
	"node_kind" text DEFAULT 'root' NOT NULL,
	"node_key" text DEFAULT 'root' NOT NULL,
	"field_path" text NOT NULL,
	"locale" text DEFAULT 'default' NOT NULL,
	"audience" text DEFAULT 'default' NOT NULL,
	"market" text DEFAULT 'default' NOT NULL,
	"action" text NOT NULL,
	"previous_value" jsonb,
	"next_value" jsonb,
	"previous_version" integer,
	"next_version" integer,
	"origin" jsonb NOT NULL,
	"editorial_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_overlay_history_overlay_idx" ON "catalog_overlay_history" USING btree ("overlay_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_overlay_history_target_idx" ON "catalog_overlay_history" USING btree ("entity_module","entity_id","node_kind","node_key","field_path","locale");
