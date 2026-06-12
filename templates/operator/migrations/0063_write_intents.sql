CREATE TABLE "write_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "write_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "write_intents_idempotency_key_uniq" ON "write_intents" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "write_intents_pending_idx" ON "write_intents" USING btree ("created_at") WHERE "write_intents"."status" = 'pending';