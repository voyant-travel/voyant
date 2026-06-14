CREATE TABLE IF NOT EXISTS "notification_reminder_rule_authoring_requests" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"reminder_rule_id" text NOT NULL,
	"operation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "notification_reminder_rule_authoring_requests"
		ADD CONSTRAINT "notification_reminder_rule_authoring_requests_reminder_rule_id_notification_reminder_rules_id_fk"
		FOREIGN KEY ("reminder_rule_id") REFERENCES "public"."notification_reminder_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_reminder_rule_authoring_rule" ON "notification_reminder_rule_authoring_requests" USING btree ("reminder_rule_id");
