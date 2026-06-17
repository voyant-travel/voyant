ALTER TABLE "organizations" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;