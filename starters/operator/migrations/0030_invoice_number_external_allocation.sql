ALTER TYPE "public"."invoice_status" ADD VALUE IF NOT EXISTS 'pending_external_allocation';--> statement-breakpoint
ALTER TABLE "invoice_number_series" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_number_series" ADD COLUMN IF NOT EXISTS "external_provider" text;--> statement-breakpoint
ALTER TABLE "invoice_number_series" ADD COLUMN IF NOT EXISTS "external_config_key" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_number_series_scope_default" ON "invoice_number_series" USING btree ("scope","is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_number_series_external_provider" ON "invoice_number_series" USING btree ("external_provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_invoice_number_series_default_scope_active" ON "invoice_number_series" USING btree ("scope") WHERE active = true AND is_default = true;
