CREATE TYPE "public"."workflow_run_status" AS ENUM('running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_step_status" AS ENUM('running', 'succeeded', 'failed', 'skipped', 'compensated');--> statement-breakpoint
CREATE TABLE "workflow_run_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"step_name" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" "workflow_run_step_status" DEFAULT 'running' NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_name" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"correlation_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "workflow_run_status" DEFAULT 'running' NOT NULL,
	"input" jsonb,
	"result" jsonb,
	"error" jsonb,
	"parent_run_id" text,
	"triggered_by_user_id" text,
	"resume_from_step" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_workflow_runs_completion" CHECK ((
        "workflow_runs"."status" = 'running' AND "workflow_runs"."completed_at" IS NULL
      ) OR (
        "workflow_runs"."status" <> 'running' AND "workflow_runs"."completed_at" IS NOT NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workflow_run_steps_run" ON "workflow_run_steps" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_workflow_run_steps_status" ON "workflow_run_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_workflow" ON "workflow_runs" USING btree ("workflow_name","started_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_status_started" ON "workflow_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_correlation" ON "workflow_runs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_parent" ON "workflow_runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_tags_gin" ON "workflow_runs" USING gin ("tags");