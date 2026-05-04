ALTER TABLE "cruise_cabin_categories" ADD COLUMN "customer_payment_policy" jsonb;--> statement-breakpoint
ALTER TABLE "cruise_sailings" ADD COLUMN "customer_payment_policy" jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "customer_payment_policy" jsonb;