DO $$ BEGIN
 CREATE TYPE "public"."conversation_ingress_status" AS ENUM('committed', 'drifted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_part_delivery_status" AS ENUM('received', 'pending', 'accepted', 'delivered', 'failed', 'bounced', 'complained', 'suppressed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_part_direction" AS ENUM('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_participant_role" AS ENUM('customer', 'staff');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_status" AS ENUM('open', 'closed', 'snoozed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "conversation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_ingress_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"external_envelope_id" text NOT NULL,
	"external_message_id" text NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"conversation_part_id" text,
	"status" "conversation_ingress_status" DEFAULT 'committed' NOT NULL,
	"error" text,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "conversation_participant_role" NOT NULL,
	"address" text NOT NULL,
	"person_ref" text,
	"contact_point_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_parts" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"direction" "conversation_part_direction" NOT NULL,
	"sender_address" text NOT NULL,
	"recipient_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"text_body" text,
	"html_body" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_source_id" text,
	"external_message_id" text,
	"message_id" text,
	"in_reply_to" text,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"notification_delivery_id" text,
	"idempotency_key" text,
	"delivery_status" "conversation_part_delivery_status" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"subject" text,
	"suggested_subject" text,
	"reply_alias" text NOT NULL,
	"customer_address" text NOT NULL,
	"person_ref" text,
	"contact_point_ref" text,
	"start_idempotency_key" text,
	"start_payload_fingerprint" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"snoozed_until" timestamp with time zone,
	"last_part_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_ingress_operations" ADD CONSTRAINT "conversation_ingress_operations_conversation_part_id_conversation_parts_id_fk" FOREIGN KEY ("conversation_part_id") REFERENCES "public"."conversation_parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_parts" ADD CONSTRAINT "conversation_parts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conversation_events_conversation" ON "conversation_events" USING btree ("conversation_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_ingress_envelope" ON "conversation_ingress_operations" USING btree ("source_id","external_envelope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_ingress_message" ON "conversation_ingress_operations" USING btree ("source_id","external_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_participant_address" ON "conversation_participants" USING btree ("conversation_id","role","address");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_parts_external_message" ON "conversation_parts" USING btree ("external_source_id","external_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_parts_message_id" ON "conversation_parts" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_parts_idempotency" ON "conversation_parts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_conversation_parts_conversation_occurred" ON "conversation_parts" USING btree ("conversation_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversations_reply_alias" ON "conversations" USING btree ("reply_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversations_start_idempotency" ON "conversations" USING btree ("start_idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_conversations_last_part" ON "conversations" USING btree ("last_part_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_person" ON "conversations" USING btree ("person_ref");