ALTER TABLE "organizations" RENAME COLUMN "vat_number" TO "tax_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_tax_id" ON "organizations" USING btree ("tax_id");
