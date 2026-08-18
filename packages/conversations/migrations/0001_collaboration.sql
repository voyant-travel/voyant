DO $$ BEGIN
 CREATE TYPE "public"."conversation_inbox_membership_role" AS ENUM('member', 'manager');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_priority" AS ENUM('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "conversation_inbox_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"inbox_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "conversation_inbox_membership_role" DEFAULT 'member' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_inboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_read_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_sequence" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_events" ADD COLUMN "actor_user_id" text;--> statement-breakpoint
ALTER TABLE "conversation_events" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "conversation_events" ADD COLUMN "revision" integer;--> statement-breakpoint
ALTER TABLE "conversation_parts" ADD COLUMN "sequence" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "inbox_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "assigned_to_user_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "priority" "conversation_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "next_part_sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
INSERT INTO "conversation_inboxes" ("id", "name", "description", "is_default")
VALUES ('cvin_01k2p3q4r5s6t7v8w9x0y1z2a3', 'Inbox', 'Default customer communications Inbox', true)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
UPDATE "conversations"
SET "inbox_id" = (
	SELECT "id" FROM "conversation_inboxes" ORDER BY "is_default" DESC, "created_at" ASC LIMIT 1
)
WHERE "inbox_id" IS NULL;--> statement-breakpoint
WITH sequenced AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "conversation_id" ORDER BY "occurred_at" ASC, "created_at" ASC, "id" ASC
	)::integer AS "sequence"
	FROM "conversation_parts"
)
UPDATE "conversation_parts"
SET "sequence" = sequenced."sequence"
FROM sequenced
WHERE "conversation_parts"."id" = sequenced."id";--> statement-breakpoint
WITH revised AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "conversation_id" ORDER BY "occurred_at" ASC, "id" ASC
	)::integer AS "revision"
	FROM "conversation_events"
)
UPDATE "conversation_events"
SET "revision" = revised."revision"
FROM revised
WHERE "conversation_events"."id" = revised."id";--> statement-breakpoint
UPDATE "conversations" AS c
SET
	"revision" = greatest(1, coalesce((SELECT max(e."revision") FROM "conversation_events" e WHERE e."conversation_id" = c."id"), 1)),
	"next_part_sequence" = coalesce((SELECT max(p."sequence") + 1 FROM "conversation_parts" p WHERE p."conversation_id" = c."id"), 1);--> statement-breakpoint
ALTER TABLE "conversation_events" ALTER COLUMN "revision" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_parts" ALTER COLUMN "sequence" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "inbox_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_inbox_memberships" ADD CONSTRAINT "conversation_inbox_memberships_inbox_id_conversation_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."conversation_inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_read_cursors" ADD CONSTRAINT "conversation_read_cursors_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_inbox_membership" ON "conversation_inbox_memberships" USING btree ("inbox_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_inboxes_name" ON "conversation_inboxes" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_inboxes_single_default" ON "conversation_inboxes" USING btree ("is_default") WHERE "conversation_inboxes"."is_default" = true;--> statement-breakpoint
CREATE INDEX "idx_conversation_notes_conversation" ON "conversation_notes" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_read_cursor" ON "conversation_read_cursors" USING btree ("conversation_id","user_id");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_inbox_id_conversation_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."conversation_inboxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversation_parts_sequence" ON "conversation_parts" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_conversations_inbox_status" ON "conversations" USING btree ("inbox_id","status","last_part_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_assignee" ON "conversations" USING btree ("assigned_to_user_id","last_part_at");--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "unread_count";
