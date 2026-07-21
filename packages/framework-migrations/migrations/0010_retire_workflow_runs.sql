-- Workflow Runs is retired from the product graph. Remove its persisted run
-- history from upgraded deployments so the legacy path converges with fresh
-- package-owned schema composition.
DROP TABLE IF EXISTS "workflow_run_steps" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_runs" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "workflow_run_step_status";--> statement-breakpoint
DROP TYPE IF EXISTS "workflow_run_status";
