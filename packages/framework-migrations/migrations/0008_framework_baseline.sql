ALTER TABLE "cloud_auth_user_links" ADD COLUMN IF NOT EXISTS "scopes" jsonb;
