CREATE TABLE "sms_transport_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_account_id" text NOT NULL,
	"destination_address" text NOT NULL,
	"state" text NOT NULL,
	"last_event_occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_transport_policy_events" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_account_id" text NOT NULL,
	"destination_address" text NOT NULL,
	"source_id" text NOT NULL,
	"external_message_id" text NOT NULL,
	"kind" text NOT NULL,
	"adapter_handled_response" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_channel_accounts" ADD COLUMN "inbound_identity" text DEFAULT null;--> statement-breakpoint
ALTER TABLE "notification_channel_accounts" ADD COLUMN "inbound_source_id" text;--> statement-breakpoint
ALTER TABLE "notification_channel_accounts" ADD COLUMN "attachments_capable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_transport_policies" ADD CONSTRAINT "sms_transport_policies_channel_account_id_notification_channel_accounts_id_fk" FOREIGN KEY ("channel_account_id") REFERENCES "public"."notification_channel_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_transport_policy_events" ADD CONSTRAINT "sms_transport_policy_events_channel_account_id_notification_channel_accounts_id_fk" FOREIGN KEY ("channel_account_id") REFERENCES "public"."notification_channel_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_sms_transport_policy_scope" ON "sms_transport_policies" USING btree ("channel_account_id","destination_address");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_sms_transport_policy_event_external" ON "sms_transport_policy_events" USING btree ("source_id","external_message_id");--> statement-breakpoint
CREATE INDEX "idx_sms_transport_policy_events_scope" ON "sms_transport_policy_events" USING btree ("channel_account_id","destination_address","occurred_at");
