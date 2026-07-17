CREATE TYPE "public"."app_distribution" AS ENUM('custom', 'marketplace');--> statement-breakpoint
CREATE TYPE "public"."app_lifecycle_state" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."app_credential_kind" AS ENUM('client_secret', 'signing_key');--> statement-breakpoint
CREATE TYPE "public"."app_release_state" AS ENUM('available', 'suspended', 'yanked');--> statement-breakpoint
CREATE TYPE "public"."app_release_artifact_state" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TABLE "apps" (
  "id" text PRIMARY KEY NOT NULL,
  "platform_namespace" text NOT NULL,
  "distribution" "app_distribution" NOT NULL,
  "owner_id" text NOT NULL,
  "display_name" text NOT NULL,
  "slug" text NOT NULL,
  "lifecycle_state" "app_lifecycle_state" DEFAULT 'active' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "apps_platform_namespace_reserved" CHECK ("apps"."platform_namespace" LIKE 'app--%')
);--> statement-breakpoint
CREATE TABLE "app_redirect_uris" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "app_credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL,
  "kind" "app_credential_kind" NOT NULL,
  "generation" integer NOT NULL,
  "kms_key_ref" text NOT NULL,
  "public_key_ref" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retired_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "app_releases" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL,
  "release_version" text NOT NULL,
  "manifest_schema_version" text NOT NULL,
  "manifest_digest" text NOT NULL,
  "manifest_snapshot" jsonb NOT NULL,
  "normalized_record" jsonb NOT NULL,
  "api_compatibility" jsonb NOT NULL,
  "default_locale" text NOT NULL,
  "supported_locales" jsonb NOT NULL,
  "state" "app_release_state" DEFAULT 'available' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "app_release_artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "release_id" text NOT NULL,
  "digest" text NOT NULL,
  "signature" text,
  "provenance" jsonb NOT NULL,
  "registry_coordinates" jsonb,
  "asset_inventory" jsonb NOT NULL,
  "state" "app_release_artifact_state" DEFAULT 'available' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "app_release_localizations" (
  "id" text PRIMARY KEY NOT NULL,
  "release_id" text NOT NULL,
  "locale" text NOT NULL,
  "surface" text NOT NULL,
  "message_key" text NOT NULL,
  "text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "app_redirect_uris" ADD CONSTRAINT "app_redirect_uris_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_credentials" ADD CONSTRAINT "app_credentials_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_release_artifacts" ADD CONSTRAINT "app_release_artifacts_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_release_localizations" ADD CONSTRAINT "app_release_localizations_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_apps_platform_namespace" ON "apps" USING btree ("platform_namespace");--> statement-breakpoint
CREATE INDEX "idx_apps_owner" ON "apps" USING btree ("owner_id","distribution","lifecycle_state");--> statement-breakpoint
CREATE INDEX "idx_app_redirect_uris_app" ON "app_redirect_uris" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_redirect_uris_exact" ON "app_redirect_uris" USING btree ("app_id","redirect_uri");--> statement-breakpoint
CREATE INDEX "idx_app_credentials_app" ON "app_credentials" USING btree ("app_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_credentials_generation" ON "app_credentials" USING btree ("app_id","kind","generation");--> statement-breakpoint
CREATE INDEX "idx_app_releases_app" ON "app_releases" USING btree ("app_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_releases_digest" ON "app_releases" USING btree ("app_id","manifest_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_releases_version" ON "app_releases" USING btree ("app_id","release_version");--> statement-breakpoint
CREATE INDEX "idx_app_release_artifacts_release" ON "app_release_artifacts" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_release_artifacts_digest" ON "app_release_artifacts" USING btree ("release_id","digest");--> statement-breakpoint
CREATE INDEX "idx_app_release_localizations_release" ON "app_release_localizations" USING btree ("release_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_release_localizations_key" ON "app_release_localizations" USING btree ("release_id","locale","surface","message_key");
