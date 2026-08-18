ALTER TYPE "public"."conversation_part_delivery_status" RENAME TO "conversation_part_admission_status";--> statement-breakpoint
ALTER TABLE "conversation_parts" RENAME COLUMN "delivery_status" TO "admission_status";--> statement-breakpoint
ALTER TABLE "conversation_parts" ALTER COLUMN "admission_status" SET DATA TYPE text USING "admission_status"::text;--> statement-breakpoint
DROP TYPE "public"."conversation_part_admission_status";--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_part_admission_status" AS ENUM('received', 'pending', 'admitted', 'suppressed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
UPDATE "conversation_parts"
SET "admission_status" = CASE
  WHEN "admission_status" = 'received' THEN 'received'
  WHEN "admission_status" = 'pending' THEN 'pending'
  WHEN "admission_status" = 'suppressed' THEN 'suppressed'
  ELSE 'admitted'
END;--> statement-breakpoint
ALTER TABLE "conversation_parts" ALTER COLUMN "admission_status" SET DATA TYPE "public"."conversation_part_admission_status" USING "admission_status"::"public"."conversation_part_admission_status";--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "reply_alias" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "channel_account_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "local_address" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "conversations" SET "closed_at" = "updated_at" WHERE "status" = 'closed';--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_conversations_active_sms_pair" ON "conversations" USING btree ("channel_account_id","customer_address") WHERE "conversations"."channel" = 'sms' AND "conversations"."status" IN ('open', 'snoozed');
