ALTER TABLE "products" ADD COLUMN "contract_template_id" text;--> statement-breakpoint
CREATE INDEX "idx_products_contract_template" ON "products" USING btree ("contract_template_id");
