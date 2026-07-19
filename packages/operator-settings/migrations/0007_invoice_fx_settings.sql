ALTER TABLE "booking_tax_settings" ADD COLUMN "base_currency" text;--> statement-breakpoint
ALTER TABLE "booking_tax_settings" ADD COLUMN "fx_commission_bps" integer;--> statement-breakpoint
ALTER TABLE "booking_tax_settings" ADD COLUMN "fx_commission_invoice_mention" text;