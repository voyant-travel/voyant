ALTER TABLE "cloud_auth_user_links" ADD COLUMN IF NOT EXISTS "scopes" jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "permissions" jsonb;
