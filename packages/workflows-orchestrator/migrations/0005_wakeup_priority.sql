ALTER TABLE "voyant_wakeups" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "voyant_wakeups_due_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voyant_wakeups_due_idx" ON "voyant_wakeups" USING btree ("priority" DESC,"wake_at" ASC);
