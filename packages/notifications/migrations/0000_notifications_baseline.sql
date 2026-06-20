DO $$ BEGIN
 CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_reminder_run_status" AS ENUM('queued', 'processing', 'sent', 'skipped', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_reminder_stage_anchor" AS ENUM('due_date', 'booking_created_at', 'departure_date', 'invoice_issued_at', 'last_send_at');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_reminder_stage_cadence_kind" AS ENUM('once', 'every_n_days', 'escalating');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_reminder_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_reminder_target_type" AS ENUM('booking_confirmed', 'booking_payment_schedule', 'payment_complete', 'booking_cancelled_non_payment', 'invoice');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_stage_recipient_kind" AS ENUM('primary', 'cc', 'bcc');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_target_type" AS ENUM('booking', 'booking_payment_schedule', 'booking_guarantee', 'invoice', 'payment_session', 'person', 'organization', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_template_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text,
	"template_slug" text,
	"target_type" "notification_target_type" DEFAULT 'other' NOT NULL,
	"target_id" text,
	"person_id" text,
	"organization_id" text,
	"booking_id" text,
	"invoice_id" text,
	"payment_session_id" text,
	"channel" "notification_channel" NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"to_address" text NOT NULL,
	"from_address" text,
	"subject" text,
	"html_body" text,
	"text_body" text,
	"payload_data" jsonb,
	"metadata" jsonb,
	"error_message" text,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reminder_rule_authoring_requests" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"reminder_rule_id" text NOT NULL,
	"operation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reminder_rule_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"reminder_rule_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"name" text,
	"anchor" "notification_reminder_stage_anchor" NOT NULL,
	"window_start_days" integer NOT NULL,
	"window_end_days" integer NOT NULL,
	"cadence_kind" "notification_reminder_stage_cadence_kind" NOT NULL,
	"cadence_every_days" integer,
	"cadence_intervals" jsonb,
	"max_sends_in_stage" integer,
	"respect_quiet_hours" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reminder_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "notification_reminder_status" DEFAULT 'draft' NOT NULL,
	"target_type" "notification_reminder_target_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"provider" text,
	"template_id" text,
	"template_slug" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"suppression_group" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reminder_rules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notification_reminder_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"reminder_rule_id" text NOT NULL,
	"target_type" "notification_reminder_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"booking_id" text,
	"person_id" text,
	"organization_id" text,
	"payment_session_id" text,
	"notification_delivery_id" text,
	"status" "notification_reminder_run_status" NOT NULL,
	"recipient" text,
	"scheduled_for" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reminder_runs_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "notification_reminder_stage_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"provider" text,
	"template_id" text,
	"template_slug" text,
	"recipient_kind" "notification_stage_recipient_kind" DEFAULT 'primary' NOT NULL,
	"recipient_role" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text DEFAULT 'default' NOT NULL,
	"quiet_hours_local" jsonb,
	"blackout_dates" jsonb,
	"skip_weekends" boolean DEFAULT false NOT NULL,
	"recipient_rate_limit_per_day" integer,
	"suppression_window_hours" integer DEFAULT 24 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"provider" text,
	"status" "notification_template_status" DEFAULT 'draft' NOT NULL,
	"subject_template" text,
	"html_template" text,
	"text_template" text,
	"from_address" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_rule_authoring_requests" ADD CONSTRAINT "notification_reminder_rule_authoring_requests_reminder_rule_id_notification_reminder_rules_id_fk" FOREIGN KEY ("reminder_rule_id") REFERENCES "public"."notification_reminder_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_rule_stages" ADD CONSTRAINT "notification_reminder_rule_stages_reminder_rule_id_notification_reminder_rules_id_fk" FOREIGN KEY ("reminder_rule_id") REFERENCES "public"."notification_reminder_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_rules" ADD CONSTRAINT "notification_reminder_rules_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_runs" ADD CONSTRAINT "notification_reminder_runs_reminder_rule_id_notification_reminder_rules_id_fk" FOREIGN KEY ("reminder_rule_id") REFERENCES "public"."notification_reminder_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_runs" ADD CONSTRAINT "notification_reminder_runs_notification_delivery_id_notification_deliveries_id_fk" FOREIGN KEY ("notification_delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_stage_channels" ADD CONSTRAINT "notification_reminder_stage_channels_stage_id_notification_reminder_rule_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."notification_reminder_rule_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_stage_channels" ADD CONSTRAINT "notification_reminder_stage_channels_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_created" ON "notification_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_template_created" ON "notification_deliveries" USING btree ("template_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_target_created" ON "notification_deliveries" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_person_created" ON "notification_deliveries" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_org_created" ON "notification_deliveries" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_booking_created" ON "notification_deliveries" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_invoice_created" ON "notification_deliveries" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_payment_session_created" ON "notification_deliveries" USING btree ("payment_session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_channel_created" ON "notification_deliveries" USING btree ("channel","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_provider_created" ON "notification_deliveries" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_status_created" ON "notification_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_scheduled_for" ON "notification_deliveries" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rule_authoring_rule" ON "notification_reminder_rule_authoring_requests" USING btree ("reminder_rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_reminder_rule_stages_rule_order" ON "notification_reminder_rule_stages" USING btree ("reminder_rule_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rule_stages_rule" ON "notification_reminder_rule_stages" USING btree ("reminder_rule_id");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rule_stages_anchor" ON "notification_reminder_rule_stages" USING btree ("anchor");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_updated" ON "notification_reminder_rules" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_status_updated" ON "notification_reminder_rules" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_target_updated" ON "notification_reminder_rules" USING btree ("target_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_channel_updated" ON "notification_reminder_rules" USING btree ("channel","updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_priority" ON "notification_reminder_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_suppression_group" ON "notification_reminder_rules" USING btree ("suppression_group");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_reminder_rules_slug" ON "notification_reminder_rules" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_created" ON "notification_reminder_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_rule_created" ON "notification_reminder_runs" USING btree ("reminder_rule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_target_created" ON "notification_reminder_runs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_booking_created" ON "notification_reminder_runs" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_payment_session_created" ON "notification_reminder_runs" USING btree ("payment_session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_delivery_created" ON "notification_reminder_runs" USING btree ("notification_delivery_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_person_created" ON "notification_reminder_runs" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_org_created" ON "notification_reminder_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_recipient_created" ON "notification_reminder_runs" USING btree ("recipient","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_runs_status_created" ON "notification_reminder_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_reminder_runs_dedupe" ON "notification_reminder_runs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_stage_channels_stage" ON "notification_reminder_stage_channels" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_stage_channels_template" ON "notification_reminder_stage_channels" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_settings_scope" ON "notification_settings" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_updated" ON "notification_templates" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_channel_updated" ON "notification_templates" USING btree ("channel","updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_provider_updated" ON "notification_templates" USING btree ("provider","updated_at");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_status_updated" ON "notification_templates" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_templates_slug" ON "notification_templates" USING btree ("slug");