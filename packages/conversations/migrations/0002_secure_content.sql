DO $$ BEGIN
 CREATE TYPE "public"."conversation_attachment_availability" AS ENUM('active', 'quarantined', 'redaction_pending', 'redacted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_attachment_scan_status" AS ENUM('pending', 'clean', 'blocked', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_part_classification" AS ENUM('message', 'automatic_reply', 'delivery_status', 'complaint', 'suspicious');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_part_content_status" AS ENUM('safe', 'quarantined', 'redacted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "conversation_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"part_id" text,
	"source_id" text,
	"external_id" text,
	"private_handle" text,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"disposition" text DEFAULT 'attachment' NOT NULL,
	"inline_content_id" text,
	"scan_status" "conversation_attachment_scan_status" DEFAULT 'pending' NOT NULL,
	"availability" "conversation_attachment_availability" DEFAULT 'quarantined' NOT NULL,
	"retention_until" timestamp with time zone,
	"scanned_at" timestamp with time zone,
	"redacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_parts" ADD COLUMN "content_status" "conversation_part_content_status" DEFAULT 'safe' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_parts" ADD COLUMN "legacy_attachment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_parts" ADD COLUMN "classification" "conversation_part_classification" DEFAULT 'message' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_parts" ADD COLUMN "replyable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_attachments" ADD CONSTRAINT "conversation_attachments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_attachments" ADD CONSTRAINT "conversation_attachments_part_id_conversation_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."conversation_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_attachment_handle" ON "conversation_attachments" USING btree ("private_handle");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_attachment_external" ON "conversation_attachments" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_attachments_conversation" ON "conversation_attachments" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_conversation_attachments_part" ON "conversation_attachments" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_attachments_retention" ON "conversation_attachments" USING btree ("availability","retention_until");--> statement-breakpoint
UPDATE "conversation_parts"
SET
	"legacy_attachment_count" = CASE
		WHEN jsonb_typeof("attachments") = 'array' THEN jsonb_array_length("attachments")
		ELSE 0
	END,
	"content_status" = CASE
		WHEN jsonb_typeof("attachments") = 'array' AND jsonb_array_length("attachments") > 0
			THEN 'quarantined'::"conversation_part_content_status"
		ELSE "content_status"
	END;--> statement-breakpoint
ALTER TABLE "conversation_parts" DROP COLUMN "attachments";
