CREATE TYPE "public"."app_access_credential_status" AS ENUM('active', 'inactive', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."app_audit_event_kind" AS ENUM('lifecycle', 'grant', 'credential', 'reconciliation', 'purge');--> statement-breakpoint
CREATE TYPE "public"."app_grant_status" AS ENUM('requested', 'granted', 'optional', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."app_installation_registration_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."app_installation_status" AS ENUM('pending', 'authorizing', 'active', 'paused', 'degraded', 'revoked', 'uninstalled');--> statement-breakpoint
CREATE TYPE "public"."app_installation_update_policy" AS ENUM('manual', 'compatible', 'patch', 'pinned');--> statement-breakpoint
CREATE TYPE "public"."app_webhook_subscription_status" AS ENUM('active', 'inactive', 'failed');--> statement-breakpoint
CREATE TABLE "app_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"deployment_id" text NOT NULL,
	"release_id" text NOT NULL,
	"status" "app_installation_status" DEFAULT 'pending' NOT NULL,
	"namespace" text NOT NULL,
	"installed_by" text NOT NULL,
	"update_policy" "app_installation_update_policy" DEFAULT 'compatible' NOT NULL,
	"last_compatible_release_check_at" timestamp with time zone,
	"pending_release_id" text,
	"pending_reason" text,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"authorized_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"degraded_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"uninstalled_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_installations_namespace_reserved" CHECK ("app_installations"."namespace" LIKE 'app--%')
);
--> statement-breakpoint
CREATE TABLE "app_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"scope" text NOT NULL,
	"status" "app_grant_status" NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_access_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"generation" integer NOT NULL,
	"credential_hash" text NOT NULL,
	"encrypted_metadata" jsonb NOT NULL,
	"status" "app_access_credential_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_installation_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"settings" jsonb NOT NULL,
	"schema_digest" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_secret_references" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"key" text NOT NULL,
	"secret_ref" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_extension_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"release_id" text NOT NULL,
	"extension_key" text NOT NULL,
	"descriptor" jsonb NOT NULL,
	"status" "app_installation_registration_status" DEFAULT 'active' NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"release_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_version" text NOT NULL,
	"endpoint_url" text NOT NULL,
	"status" "app_webhook_subscription_status" DEFAULT 'active' NOT NULL,
	"external_subscription_id" text,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text,
	"app_id" text NOT NULL,
	"deployment_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"kind" "app_audit_event_kind" NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_installations" ADD CONSTRAINT "app_installations_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installations" ADD CONSTRAINT "app_installations_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_grants" ADD CONSTRAINT "app_grants_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD CONSTRAINT "app_access_credentials_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation_settings" ADD CONSTRAINT "app_installation_settings_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_secret_references" ADD CONSTRAINT "app_secret_references_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_extension_installations" ADD CONSTRAINT "app_extension_installations_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_extension_installations" ADD CONSTRAINT "app_extension_installations_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD CONSTRAINT "app_webhook_subscriptions_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD CONSTRAINT "app_webhook_subscriptions_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_audit_events" ADD CONSTRAINT "app_audit_events_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_installations_app" ON "app_installations" USING btree ("app_id","status");--> statement-breakpoint
CREATE INDEX "idx_app_installations_deployment" ON "app_installations" USING btree ("deployment_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_installations_deployment_app" ON "app_installations" USING btree ("deployment_id","app_id");--> statement-breakpoint
CREATE INDEX "idx_app_grants_installation" ON "app_grants" USING btree ("installation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_grants_scope" ON "app_grants" USING btree ("installation_id","scope");--> statement-breakpoint
CREATE INDEX "idx_app_access_credentials_installation" ON "app_access_credentials" USING btree ("installation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_access_credentials_generation" ON "app_access_credentials" USING btree ("installation_id","generation");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_installation_settings_installation" ON "app_installation_settings" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_secret_references_key" ON "app_secret_references" USING btree ("installation_id","key");--> statement-breakpoint
CREATE INDEX "idx_app_extension_installations_installation" ON "app_extension_installations" USING btree ("installation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_extension_installations_key" ON "app_extension_installations" USING btree ("installation_id","extension_key");--> statement-breakpoint
CREATE INDEX "idx_app_webhook_subscriptions_installation" ON "app_webhook_subscriptions" USING btree ("installation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_webhook_subscriptions_event" ON "app_webhook_subscriptions" USING btree ("installation_id","event_type","event_version","endpoint_url");--> statement-breakpoint
CREATE INDEX "idx_app_audit_events_installation" ON "app_audit_events" USING btree ("installation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_app_audit_events_app" ON "app_audit_events" USING btree ("app_id","deployment_id","created_at");
