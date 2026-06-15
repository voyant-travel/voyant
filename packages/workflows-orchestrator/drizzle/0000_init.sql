CREATE TABLE "voyant_snapshot_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" bigint NOT NULL,
	"completed_at" bigint,
	"duration_ms" integer,
	"tags" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"input" jsonb NOT NULL,
	"entry_file" text,
	"replay_of" text
);
--> statement-breakpoint
CREATE TABLE "voyant_wakeups" (
	"run_id" text PRIMARY KEY NOT NULL,
	"wake_at" bigint NOT NULL,
	"lease_owner" text,
	"lease_expires_at" bigint,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "voyant_snapshot_runs_workflow_started_idx" ON "voyant_snapshot_runs" USING btree ("workflow_id","started_at");--> statement-breakpoint
CREATE INDEX "voyant_snapshot_runs_status_started_idx" ON "voyant_snapshot_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "voyant_wakeups_due_idx" ON "voyant_wakeups" USING btree ("wake_at");--> statement-breakpoint
CREATE INDEX "voyant_wakeups_lease_idx" ON "voyant_wakeups" USING btree ("lease_expires_at");