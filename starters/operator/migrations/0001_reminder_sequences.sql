CREATE TYPE "public"."notification_reminder_stage_anchor" AS ENUM('due_date', 'booking_created_at', 'departure_date', 'invoice_issued_at', 'last_send_at');--> statement-breakpoint
CREATE TYPE "public"."notification_reminder_stage_cadence_kind" AS ENUM('once', 'every_n_days', 'escalating');--> statement-breakpoint
CREATE TYPE "public"."notification_stage_recipient_kind" AS ENUM('primary', 'cc', 'bcc');--> statement-breakpoint
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
	"holiday_calendar" text,
	"recipient_rate_limit_per_day" integer,
	"suppression_window_hours" integer DEFAULT 24 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_reminder_rules" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_reminder_rules" ADD COLUMN "suppression_group" text;--> statement-breakpoint
ALTER TABLE "notification_reminder_rule_stages" ADD CONSTRAINT "notification_reminder_rule_stages_reminder_rule_id_notification_reminder_rules_id_fk" FOREIGN KEY ("reminder_rule_id") REFERENCES "public"."notification_reminder_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_stage_channels" ADD CONSTRAINT "notification_reminder_stage_channels_stage_id_notification_reminder_rule_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."notification_reminder_rule_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reminder_stage_channels" ADD CONSTRAINT "notification_reminder_stage_channels_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_reminder_rule_stages_rule_order" ON "notification_reminder_rule_stages" USING btree ("reminder_rule_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rule_stages_rule" ON "notification_reminder_rule_stages" USING btree ("reminder_rule_id");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rule_stages_anchor" ON "notification_reminder_rule_stages" USING btree ("anchor");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_stage_channels_stage" ON "notification_reminder_stage_channels" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_stage_channels_template" ON "notification_reminder_stage_channels" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_settings_scope" ON "notification_settings" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_priority" ON "notification_reminder_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_notification_reminder_rules_suppression_group" ON "notification_reminder_rules" USING btree ("suppression_group");--> statement-breakpoint
-- Seed a default notification_settings row so settings lookups always resolve.
INSERT INTO "notification_settings" ("id", "scope")
VALUES ('nset_' || replace(gen_random_uuid()::text, '-', ''), 'default')
ON CONFLICT ("scope") DO NOTHING;--> statement-breakpoint
-- Back-fill: one stage per existing rule, one channel per stage, mirroring the legacy
-- single-offset behavior (window=[offset, offset], cadence=once, anchor=due_date).
INSERT INTO "notification_reminder_rule_stages" (
  "id", "reminder_rule_id", "order_index", "anchor",
  "window_start_days", "window_end_days", "cadence_kind"
)
SELECT
  'ntrs_' || replace(gen_random_uuid()::text, '-', ''),
  "id", 0, 'due_date',
  -"relative_days_from_due_date", -"relative_days_from_due_date", 'once'
FROM "notification_reminder_rules"
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_reminder_rule_stages" s
  WHERE s."reminder_rule_id" = "notification_reminder_rules"."id"
);--> statement-breakpoint
INSERT INTO "notification_reminder_stage_channels" (
  "id", "stage_id", "order_index", "channel", "provider",
  "template_id", "template_slug", "recipient_kind"
)
SELECT
  'ntsc_' || replace(gen_random_uuid()::text, '-', ''),
  s."id", 0, r."channel", r."provider",
  r."template_id", r."template_slug", 'primary'
FROM "notification_reminder_rule_stages" s
JOIN "notification_reminder_rules" r ON r."id" = s."reminder_rule_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_reminder_stage_channels" c WHERE c."stage_id" = s."id"
);