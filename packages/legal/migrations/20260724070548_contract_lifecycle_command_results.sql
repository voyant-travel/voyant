CREATE TABLE "contract_lifecycle_command_results" (
	"claim_action_id" text PRIMARY KEY NOT NULL,
	"action_name" text NOT NULL,
	"action_version" text NOT NULL,
	"target_type" text NOT NULL,
	"contract_id" text NOT NULL,
	"transition" text NOT NULL,
	"idempotency_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"idempotency_fingerprint" text NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"organization_id" text,
	"command_payload" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_lifecycle_command_results_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "idx_contract_lifecycle_command_results_contract" ON "contract_lifecycle_command_results" USING btree ("contract_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contract_lifecycle_command_results_scope_key" ON "contract_lifecycle_command_results" USING btree ("idempotency_scope","idempotency_key");
