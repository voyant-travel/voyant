ALTER TABLE "voyant_wakeups" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DROP INDEX "voyant_wakeups_due_idx";--> statement-breakpoint
CREATE INDEX "voyant_wakeups_due_idx" ON "voyant_wakeups" USING btree ("priority" DESC,"wake_at" ASC);
