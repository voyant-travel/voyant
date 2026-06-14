CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
DROP INDEX "idx_supplier_invoices_supplier";--> statement-breakpoint
DROP INDEX "idx_supplier_invoices_supplier_created";--> statement-breakpoint
DROP INDEX "idx_supplier_invoices_status";--> statement-breakpoint
DROP INDEX "idx_supplier_invoices_status_created";--> statement-breakpoint
DROP INDEX "idx_supplier_invoices_due_date";--> statement-breakpoint
CREATE INDEX "idx_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_products_description_trgm" ON "products" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_locations_title_trgm" ON "product_locations" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_locations_city_trgm" ON "product_locations" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_destination_translations_name_trgm" ON "destination_translations" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_destination_translations_description_trgm" ON "destination_translations" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_categories_name_trgm" ON "product_categories" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_categories_slug_trgm" ON "product_categories" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_product_tags_name_trgm" ON "product_tags" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_invoices_created" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_availability_slots_starts_at" ON "availability_slots" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_supplier" ON "supplier_invoices" USING btree ("supplier_id") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_supplier_created" ON "supplier_invoices" USING btree ("supplier_id","created_at") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_status" ON "supplier_invoices" USING btree ("status") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_status_created" ON "supplier_invoices" USING btree ("status","created_at") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_due_date" ON "supplier_invoices" USING btree ("due_date") WHERE "supplier_invoices"."deleted_at" IS NULL;