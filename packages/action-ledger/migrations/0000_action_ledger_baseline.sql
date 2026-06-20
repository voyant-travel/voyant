DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_action_kind" AS ENUM('read', 'create', 'update', 'delete', 'execute', 'approve', 'reject', 'reverse', 'compensate', 'duplicate');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_approval_status" AS ENUM('pending', 'approved', 'denied', 'expired', 'cancelled', 'superseded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_principal_type" AS ENUM('user', 'api_key', 'agent', 'workflow', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_redaction_status" AS ENUM('none', 'redacted', 'tombstoned', 'crypto_shredded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_relay_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'dead_letter');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_reversal_kind" AS ENUM('none', 'revert', 'compensate', 'domain_command');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_reversal_outcome" AS ENUM('full', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_reversal_state" AS ENUM('not_reversible', 'available', 'requested', 'running', 'completed', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_risk" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."action_ledger_status" AS ENUM('requested', 'awaiting_approval', 'approved', 'denied', 'succeeded', 'failed', 'reversed', 'compensated', 'expired', 'cancelled', 'superseded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "action_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"requested_action_id" text NOT NULL,
	"status" "action_ledger_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by_principal_id" text NOT NULL,
	"assigned_to_principal_id" text,
	"decided_by_principal_id" text,
	"delegated_from_principal_id" text,
	"policy_name" text NOT NULL,
	"policy_version" text NOT NULL,
	"target_snapshot_ref" text,
	"risk_snapshot" "action_ledger_risk" NOT NULL,
	"reason_code" text,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_delegations" (
	"id" text PRIMARY KEY NOT NULL,
	"root_principal_type" "action_ledger_principal_type" NOT NULL,
	"root_principal_id" text NOT NULL,
	"parent_principal_type" "action_ledger_principal_type" NOT NULL,
	"parent_principal_id" text NOT NULL,
	"child_principal_type" "action_ledger_principal_type" NOT NULL,
	"child_principal_id" text NOT NULL,
	"grant_source" text NOT NULL,
	"capability_scope_ref" text,
	"budget_scope_ref" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_name" text NOT NULL,
	"action_version" text NOT NULL,
	"action_kind" "action_ledger_action_kind" NOT NULL,
	"status" "action_ledger_status" NOT NULL,
	"evaluated_risk" "action_ledger_risk" NOT NULL,
	"actor_type" text,
	"principal_type" "action_ledger_principal_type" NOT NULL,
	"principal_id" text NOT NULL,
	"principal_subtype" text,
	"session_id" text,
	"api_token_id" text,
	"internal_request" boolean DEFAULT false NOT NULL,
	"delegated_by_principal_type" "action_ledger_principal_type",
	"delegated_by_principal_id" text,
	"delegation_id" text,
	"caller_type" text,
	"organization_id" text,
	"route_or_tool_name" text,
	"workflow_run_id" text,
	"workflow_step_id" text,
	"correlation_id" text,
	"causation_action_id" text,
	"idempotency_scope" text,
	"idempotency_key" text,
	"idempotency_fingerprint" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"capability_id" text,
	"capability_version" text,
	"authorization_source" text,
	"approval_id" text,
	"amends_action_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_ledger_payloads" (
	"id" text PRIMARY KEY NOT NULL,
	"action_id" text NOT NULL,
	"payload_kind" text NOT NULL,
	"schema_tag" text NOT NULL,
	"redaction_status" "action_ledger_redaction_status" DEFAULT 'none' NOT NULL,
	"retention_policy" text NOT NULL,
	"storage_ref" text NOT NULL,
	"hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "action_ledger_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"action_id" text NOT NULL,
	"organization_id" text,
	"relay_status" "action_ledger_relay_status" DEFAULT 'pending' NOT NULL,
	"payload_ref" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "action_mutation_details" (
	"action_id" text PRIMARY KEY NOT NULL,
	"command_input_ref" text,
	"command_result_ref" text,
	"summary" text,
	"reversal_kind" "action_ledger_reversal_kind" DEFAULT 'none' NOT NULL,
	"reversal_command_id" text,
	"reversal_command_version" text,
	"reversal_args_ref" text,
	"reversal_state_projection" "action_ledger_reversal_state",
	"reversal_outcome_projection" "action_ledger_reversal_outcome",
	"reverses_action_id" text,
	"reversed_by_action_id_projection" text
);
--> statement-breakpoint
CREATE TABLE "action_sensitive_read_details" (
	"action_id" text PRIMARY KEY NOT NULL,
	"reason_code" text,
	"disclosed_field_set" jsonb,
	"disclosure_summary" text,
	"decision_policy" text
);
--> statement-breakpoint
ALTER TABLE "action_approvals" ADD CONSTRAINT "action_approvals_requested_action_id_action_ledger_entries_id_fk" FOREIGN KEY ("requested_action_id") REFERENCES "public"."action_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_ledger_payloads" ADD CONSTRAINT "action_ledger_payloads_action_id_action_ledger_entries_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_ledger_outbox" ADD CONSTRAINT "action_ledger_outbox_action_id_action_ledger_entries_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_mutation_details" ADD CONSTRAINT "action_mutation_details_action_id_action_ledger_entries_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_sensitive_read_details" ADD CONSTRAINT "action_sensitive_read_details_action_id_action_ledger_entries_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_action_approvals_requested_action" ON "action_approvals" USING btree ("requested_action_id");--> statement-breakpoint
CREATE INDEX "idx_action_approvals_status_expires" ON "action_approvals" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_action_approvals_assignee" ON "action_approvals" USING btree ("assigned_to_principal_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_action_delegations_root" ON "action_delegations" USING btree ("root_principal_type","root_principal_id");--> statement-breakpoint
CREATE INDEX "idx_action_delegations_child" ON "action_delegations" USING btree ("child_principal_type","child_principal_id");--> statement-breakpoint
CREATE INDEX "idx_action_delegations_parent" ON "action_delegations" USING btree ("parent_principal_type","parent_principal_id");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_principal" ON "action_ledger_entries" USING btree ("principal_type","principal_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_api_token" ON "action_ledger_entries" USING btree ("api_token_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_session" ON "action_ledger_entries" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_target" ON "action_ledger_entries" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_workflow" ON "action_ledger_entries" USING btree ("workflow_run_id","workflow_step_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_correlation" ON "action_ledger_entries" USING btree ("correlation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_causation" ON "action_ledger_entries" USING btree ("causation_action_id");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_control_state" ON "action_ledger_entries" USING btree ("evaluated_risk","status","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_entries_capability" ON "action_ledger_entries" USING btree ("capability_id","capability_version","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_action_ledger_entries_idempotency" ON "action_ledger_entries" USING btree ("idempotency_scope","action_name","target_type","target_id","idempotency_key") WHERE 
        "action_ledger_entries"."idempotency_key" IS NOT NULL
      ;--> statement-breakpoint
CREATE INDEX "idx_action_ledger_payloads_action" ON "action_ledger_payloads" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_payloads_expiry" ON "action_ledger_payloads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_outbox_action" ON "action_ledger_outbox" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_action_ledger_outbox_status_retry" ON "action_ledger_outbox" USING btree ("relay_status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_action_mutation_details_reverses" ON "action_mutation_details" USING btree ("reverses_action_id");--> statement-breakpoint
CREATE INDEX "idx_action_mutation_details_reversal_state" ON "action_mutation_details" USING btree ("reversal_state_projection");