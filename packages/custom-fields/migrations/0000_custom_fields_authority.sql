DO $$ BEGIN
 CREATE TYPE "public"."custom_field_type" AS ENUM('varchar', 'text', 'double', 'monetary', 'date', 'boolean', 'enum', 'set', 'json', 'address', 'phone');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "field_type" "custom_field_type" NOT NULL,
  "is_required" boolean DEFAULT false NOT NULL,
  "is_searchable" boolean DEFAULT false NOT NULL,
  "is_exportable" boolean DEFAULT true NOT NULL,
  "is_invoiceable" boolean DEFAULT false NOT NULL,
  "options" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_definitions"
  ALTER COLUMN "entity_type" SET DATA TYPE text
  USING "entity_type"::text;--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_definitions"
  ADD COLUMN IF NOT EXISTS "is_exportable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_definitions"
  ADD COLUMN IF NOT EXISTS "is_invoiceable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."custom_field_target";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_custom_field_definitions_entity"
  ON "custom_field_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_custom_field_definitions_entity_label"
  ON "custom_field_definitions" USING btree ("entity_type","label");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_custom_field_definitions_key"
  ON "custom_field_definitions" USING btree ("entity_type","key");
