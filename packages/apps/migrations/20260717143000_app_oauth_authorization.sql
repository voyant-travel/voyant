ALTER TYPE "public"."app_audit_event_kind" ADD VALUE IF NOT EXISTS 'consent';--> statement-breakpoint
ALTER TYPE "public"."app_audit_event_kind" ADD VALUE IF NOT EXISTS 'token';--> statement-breakpoint
CREATE TYPE "public"."app_access_token_mode" AS ENUM('offline', 'online');--> statement-breakpoint
ALTER TABLE "app_installations" ADD COLUMN "credential_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD COLUMN "token_mode" "app_access_token_mode" DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD COLUMN "actor_id" text;--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD COLUMN "viewer_id" text;--> statement-breakpoint
DROP INDEX "public"."uidx_app_access_credentials_generation";--> statement-breakpoint
CREATE INDEX "idx_app_access_credentials_generation" ON "app_access_credentials" USING btree ("installation_id","token_mode","generation");--> statement-breakpoint
CREATE TABLE "app_oauth_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"release_id" text NOT NULL,
	"deployment_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"state_hash" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"requested_scopes" jsonb NOT NULL,
	"granted_scopes" jsonb NOT NULL,
	"denied_optional_scopes" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "app_oauth_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"generation" integer NOT NULL,
	"status" "app_access_credential_status" DEFAULT 'active' NOT NULL,
	"rotated_from_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "app_oauth_authorization_codes" ADD CONSTRAINT "app_oauth_authorization_codes_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_oauth_authorization_codes" ADD CONSTRAINT "app_oauth_authorization_codes_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_oauth_authorization_codes" ADD CONSTRAINT "app_oauth_authorization_codes_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_tokens" ADD CONSTRAINT "app_oauth_refresh_tokens_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_oauth_codes_hash" ON "app_oauth_authorization_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "idx_app_oauth_codes_installation" ON "app_oauth_authorization_codes" USING btree ("installation_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_oauth_refresh_tokens_hash" ON "app_oauth_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_app_oauth_refresh_tokens_installation" ON "app_oauth_refresh_tokens" USING btree ("installation_id","status");
