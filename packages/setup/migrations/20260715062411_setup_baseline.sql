CREATE TABLE "organization_setup" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_run_opened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organization_setup_steps" (
	"step_id" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"skipped_at" timestamp with time zone
);
