ALTER TABLE "activities" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;