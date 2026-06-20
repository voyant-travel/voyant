CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "unaccent";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."roles" AS ENUM('super-admin', 'admin', 'editor', 'viewer', 'member', 'guest');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."seating_preference" AS ENUM('aisle', 'window', 'middle', 'no_preference');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."domain_provider" AS ENUM('cloudflare');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verified', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."email_provider" AS ENUM('resend', 'ses');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."resend_region" AS ENUM('us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tls_mode" AS ENUM('opportunistic', 'enforced');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "aggregate_snapshots" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stale_after" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aggregate_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"reference_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT false NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean NOT NULL,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_or_phone" CHECK ("user"."email" IS NOT NULL OR "user"."phone_number" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cloud_auth_session_links" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text DEFAULT 'voyant-cloud' NOT NULL,
	"provider_account_id" text NOT NULL,
	"deployment_id" text NOT NULL,
	"revalidate_after" timestamp with time zone NOT NULL,
	"last_revalidated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_auth_user_links" (
	"user_id" text PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"redeemed_at" timestamp with time zone,
	"redeemed_by_user_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text,
	"ui_prefs" jsonb DEFAULT '{}'::jsonb,
	"seating_preference" "seating_preference",
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_support_user" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"notification_defaults" jsonb DEFAULT '{}'::jsonb,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp with time zone,
	"marketing_consent_source" text,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "domains" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"provider" "domain_provider" DEFAULT 'cloudflare',
	"provider_hostname_id" text,
	"provider_zone_id" text,
	"certificate_status" text,
	"hostname_status" text,
	"verification_records" jsonb,
	"custom_metadata" jsonb,
	"email_provider" "email_provider",
	"email_region" "resend_region",
	"email_provider_domain_id" text,
	"email_return_path_domain" text,
	"email_tracking_domain" text,
	"email_dmarc_policy" text,
	"email_click_tracking" boolean DEFAULT false NOT NULL,
	"email_open_tracking" boolean DEFAULT false NOT NULL,
	"email_tls_mode" "tls_mode" DEFAULT 'opportunistic',
	"email_config_encrypted" text,
	"email_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb,
	"metadata" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"body_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "public_document_delivery_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"storage_key" text NOT NULL,
	"storage_provider" text,
	"filename" text,
	"content_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"source_module" text,
	"source_entity" text,
	"source_id" text,
	"created_by" text,
	"created_by_type" text,
	"metadata" jsonb,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"last_accessed_ip" text,
	"last_accessed_user_agent" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_document_delivery_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"scope" text PRIMARY KEY NOT NULL,
	"tokens_available" numeric NOT NULL,
	"capacity" numeric NOT NULL,
	"refill_rate_per_sec" numeric NOT NULL,
	"last_refill_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"source_module" text NOT NULL,
	"source_event" text NOT NULL,
	"source_entity_module" text,
	"source_entity_id" text,
	"subscription_id" text,
	"target_url" text NOT NULL,
	"target_kind" text,
	"target_ref" text,
	"request_method" text NOT NULL,
	"request_headers" jsonb,
	"request_body_hash" text,
	"request_body_excerpt" text,
	"response_status" integer,
	"response_headers" jsonb,
	"response_body_excerpt" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"parent_delivery_id" text,
	"idempotency_key" text,
	"status" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error_class" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"events" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"headers" jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_delivery_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "write_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "write_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_auth_session_links" ADD CONSTRAINT "cloud_auth_session_links_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_auth_session_links" ADD CONSTRAINT "cloud_auth_session_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_auth_user_links" ADD CONSTRAINT "cloud_auth_user_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aggregate_snapshots_stale_after" ON "aggregate_snapshots" USING btree ("stale_after");--> statement-breakpoint
CREATE INDEX "idx_apikey_reference_id" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "idx_apikey_config_id" ON "apikey" USING btree ("config_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_invitation_email" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invitation_organization_id" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_user_id" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_member_organization_id" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_user_organization" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email") WHERE "user"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_phone_unique" ON "user" USING btree ("phone_number") WHERE "user"."phone_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cloud_auth_session_user" ON "cloud_auth_session_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cloud_auth_session_revalidate_after" ON "cloud_auth_session_links" USING btree ("revalidate_after");--> statement-breakpoint
CREATE INDEX "idx_cloud_auth_session_revoked_at" ON "cloud_auth_session_links" USING btree ("revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cloud_auth_user_provider_account_unique" ON "cloud_auth_user_links" USING btree ("provider_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "idx_cloud_auth_user_deployment" ON "cloud_auth_user_links" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "idx_cloud_auth_user_revalidation" ON "cloud_auth_user_links" USING btree ("revoked_at","last_revalidated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_user_invitations_token_hash" ON "user_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_email" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_redeemed_at" ON "user_invitations" USING btree ("redeemed_at");--> statement-breakpoint
CREATE INDEX "idx_user_invitations_expires_at" ON "user_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_name" ON "user_profiles" USING btree ("first_name","last_name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_infra_domains_domain" ON "domains" USING btree (lower("domain"));--> statement-breakpoint
CREATE INDEX "idx_infra_domains_status" ON "domains" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_infra_domains_provider" ON "domains" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "event_outbox_event_id_uniq" ON "event_outbox" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_outbox_due_idx" ON "event_outbox" USING btree ("next_attempt_at") WHERE "event_outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "event_outbox_created_idx" ON "event_outbox" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_infra_idempotency_keys_scope_key" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "idx_infra_idempotency_keys_expires_at" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_public_document_delivery_grants_token_hash" ON "public_document_delivery_grants" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_public_document_delivery_grants_expires_at" ON "public_document_delivery_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_public_document_delivery_grants_source" ON "public_document_delivery_grants" USING btree ("source_module","source_entity","source_id");--> statement-breakpoint
CREATE INDEX "idx_public_document_delivery_grants_revoked_at" ON "public_document_delivery_grants" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_pending" ON "webhook_deliveries" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_module" ON "webhook_deliveries" USING btree ("source_module","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_entity" ON "webhook_deliveries" USING btree ("source_entity_module","source_entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_idempotency" ON "webhook_deliveries" USING btree ("idempotency_key","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_subscription" ON "webhook_deliveries" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_target" ON "webhook_deliveries" USING btree ("target_kind","target_ref","created_at");--> statement-breakpoint
CREATE INDEX "idx_infra_webhook_subs_active" ON "webhook_subscriptions" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_infra_webhook_subs_url" ON "webhook_subscriptions" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "write_intents_idempotency_key_uniq" ON "write_intents" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "write_intents_pending_idx" ON "write_intents" USING btree ("created_at") WHERE "write_intents"."status" = 'pending';