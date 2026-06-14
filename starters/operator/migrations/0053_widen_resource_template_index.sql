DROP INDEX IF EXISTS "idx_product_option_resource_templates_option_kind";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_option_resource_templates_option_kind" ON "product_option_resource_templates" USING btree ("product_option_id","kind",(COALESCE("ref_id", '')));
