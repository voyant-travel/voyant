CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique"
  ON "account" ("provider_id", "account_id");

CREATE TABLE IF NOT EXISTS "cloud_auth_user_links" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "provider_id" text DEFAULT 'voyant-cloud' NOT NULL,
  "provider_account_id" text NOT NULL,
  "deployment_id" text NOT NULL,
  "platform_organization_id" text NOT NULL,
  "workos_organization_id" text NOT NULL,
  "membership_id" text,
  "role_slug" text,
  "role_name" text,
  "surfaces" jsonb DEFAULT '[]'::jsonb,
  "last_assertion_at" timestamp with time zone,
  "last_revalidated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "cloud_auth_user_provider_account_unique"
  ON "cloud_auth_user_links" ("provider_id", "provider_account_id");
CREATE INDEX IF NOT EXISTS "idx_cloud_auth_user_deployment"
  ON "cloud_auth_user_links" ("deployment_id");
CREATE INDEX IF NOT EXISTS "idx_cloud_auth_user_revalidation"
  ON "cloud_auth_user_links" ("revoked_at", "last_revalidated_at");

CREATE TABLE IF NOT EXISTS "cloud_auth_session_links" (
  "session_id" text PRIMARY KEY NOT NULL REFERENCES "session"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "provider_id" text DEFAULT 'voyant-cloud' NOT NULL,
  "provider_account_id" text NOT NULL,
  "deployment_id" text NOT NULL,
  "revalidate_after" timestamp with time zone NOT NULL,
  "last_revalidated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cloud_auth_session_user"
  ON "cloud_auth_session_links" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_cloud_auth_session_revalidate_after"
  ON "cloud_auth_session_links" ("revalidate_after");
CREATE INDEX IF NOT EXISTS "idx_cloud_auth_session_revoked_at"
  ON "cloud_auth_session_links" ("revoked_at");
