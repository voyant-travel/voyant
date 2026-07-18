CREATE TYPE "public"."report_run_status" AS ENUM('running', 'succeeded', 'failed');
--> statement-breakpoint
CREATE TABLE "report_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_template_id" text,
	"source_template_version" integer,
	"draft" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_definition_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition_revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"report_version_id" text NOT NULL,
	"status" "report_run_status" DEFAULT 'running' NOT NULL,
	"parameters" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"triggered_by_user_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_definition_id_report_definitions_id_fk" FOREIGN KEY ("report_definition_id") REFERENCES "public"."report_definitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_report_version_id_report_versions_id_fk" FOREIGN KEY ("report_version_id") REFERENCES "public"."report_versions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_report_definitions_updated" ON "report_definitions" USING btree ("updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_report_versions_definition_version" ON "report_versions" USING btree ("report_definition_id","version");
--> statement-breakpoint
CREATE INDEX "idx_report_versions_definition_created" ON "report_versions" USING btree ("report_definition_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_report_runs_version_created" ON "report_runs" USING btree ("report_version_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_report_runs_status_started" ON "report_runs" USING btree ("status","started_at");
