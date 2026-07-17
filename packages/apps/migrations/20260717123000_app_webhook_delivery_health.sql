ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "signing_key_id" text;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "last_delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "paused_at" timestamp with time zone;
