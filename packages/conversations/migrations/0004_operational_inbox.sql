DO $$ BEGIN
 CREATE TYPE "public"."conversation_waiting_on" AS ENUM('staff', 'customer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "waiting_on" "conversation_waiting_on";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_inbound_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_outbound_at" timestamp with time zone;--> statement-breakpoint
UPDATE "conversations" c
SET
  "last_inbound_at" = (
    SELECT max(p."occurred_at") FROM "conversation_parts" p
    WHERE p."conversation_id" = c."id" AND p."direction" = 'inbound'
  ),
  "last_outbound_at" = (
    SELECT max(p."occurred_at") FROM "conversation_parts" p
    WHERE p."conversation_id" = c."id" AND p."direction" = 'outbound'
  ),
  "first_response_at" = (
    SELECT min(outbound."occurred_at") FROM "conversation_parts" outbound
    WHERE outbound."conversation_id" = c."id"
      AND outbound."direction" = 'outbound'
      AND outbound."occurred_at" >= coalesce((
        SELECT min(inbound."occurred_at") FROM "conversation_parts" inbound
        WHERE inbound."conversation_id" = c."id" AND inbound."direction" = 'inbound'
      ), c."created_at")
  ),
  "waiting_on" = CASE
    WHEN c."status" <> 'open' THEN NULL
    WHEN (
      SELECT p."direction" FROM "conversation_parts" p
      WHERE p."conversation_id" = c."id"
      ORDER BY p."sequence" DESC LIMIT 1
    ) = 'inbound' THEN 'staff'::"conversation_waiting_on"
    WHEN (
      SELECT p."direction" FROM "conversation_parts" p
      WHERE p."conversation_id" = c."id"
      ORDER BY p."sequence" DESC LIMIT 1
    ) = 'outbound' THEN 'customer'::"conversation_waiting_on"
    ELSE NULL
  END,
  "resolved_at" = CASE WHEN c."status" = 'closed' THEN c."updated_at" ELSE NULL END;--> statement-breakpoint
CREATE INDEX "idx_conversations_queue_cursor" ON "conversations" USING btree ("inbox_id","status","waiting_on","last_part_at","id");--> statement-breakpoint
CREATE INDEX "idx_conversations_assignee_cursor" ON "conversations" USING btree ("inbox_id","assigned_to_user_id","last_part_at","id");--> statement-breakpoint
CREATE INDEX "idx_conversations_priority_cursor" ON "conversations" USING btree ("inbox_id","priority","last_part_at","id");--> statement-breakpoint
CREATE INDEX "idx_conversations_channel_cursor" ON "conversations" USING btree ("inbox_id","channel","last_part_at","id");
