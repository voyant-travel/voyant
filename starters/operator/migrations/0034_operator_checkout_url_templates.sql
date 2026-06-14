ALTER TABLE "operator_payment_defaults"
  ADD COLUMN IF NOT EXISTS "booking_checkout_url_template" text;--> statement-breakpoint
ALTER TABLE "operator_payment_defaults"
  ADD COLUMN IF NOT EXISTS "invoice_pay_url_template" text;
