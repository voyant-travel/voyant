ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_type_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "invoices_invoice_number_type_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "invoices_invoice_number_type_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_type_active_idx" ON "invoices" USING btree ("invoice_number", "invoice_type") WHERE "status" <> 'void';
