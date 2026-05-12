CREATE TABLE IF NOT EXISTS "product_option_resource_templates" (
  "id" text PRIMARY KEY,
  "product_option_id" text NOT NULL,
  "kind" text NOT NULL,
  "ref_type" text,
  "ref_id" text,
  "capacity" integer NOT NULL,
  "name_pattern" text NOT NULL,
  "layout" text,
  "flags" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_option_resource_templates_option_kind" ON "product_option_resource_templates" USING btree ("product_option_id","kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_option_resource_templates_kind" ON "product_option_resource_templates" USING btree ("kind","created_at");
