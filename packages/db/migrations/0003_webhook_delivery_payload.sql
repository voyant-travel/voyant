ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "request_payload" jsonb;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "delivery_contract" jsonb;
