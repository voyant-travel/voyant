ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_unique";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_key";--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_invoice_number_type_unique'
      AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_invoice_number_type_unique"
      UNIQUE ("invoice_number", "invoice_type");
  END IF;
END $$;
