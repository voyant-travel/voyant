ALTER TABLE "workflow_runs" ADD COLUMN "parent_run_id" text;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "triggered_by_user_id" text;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "resume_from_step" text;--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_parent" ON "workflow_runs" USING btree ("parent_run_id");