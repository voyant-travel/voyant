CREATE TABLE IF NOT EXISTS "voyant_workflow_manifests" (
	"environment" text NOT NULL,
	"version_id" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "voyant_workflow_manifests_environment_version_id_pk" PRIMARY KEY("environment","version_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "voyant_workflow_manifests_current_idx" ON "voyant_workflow_manifests" USING btree ("environment") WHERE "voyant_workflow_manifests"."is_current";
