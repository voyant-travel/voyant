ALTER TABLE "cloud_auth_user_links" ADD COLUMN "scopes" jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "permissions" jsonb;