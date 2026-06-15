ALTER TABLE "voyant_snapshot_runs" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "voyant_snapshot_runs_idempotency_idx" ON "voyant_snapshot_runs" USING btree ("workflow_id","idempotency_key") WHERE "voyant_snapshot_runs"."idempotency_key" IS NOT NULL;
