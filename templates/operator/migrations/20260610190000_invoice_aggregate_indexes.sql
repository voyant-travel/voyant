CREATE INDEX IF NOT EXISTS "idx_invoices_outstanding_due" ON "invoices" USING btree ("status","balance_due_cents","due_date");--> statement-breakpoint
