CREATE TABLE "aggregate_snapshots" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stale_after" timestamp with time zone NOT NULL
);--> statement-breakpoint
ALTER TABLE "aggregate_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb,
	"metadata" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "event_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_aggregate_snapshots_stale_after" ON "aggregate_snapshots" USING btree ("stale_after");--> statement-breakpoint
CREATE UNIQUE INDEX "event_outbox_event_id_uniq" ON "event_outbox" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_outbox_due_idx" ON "event_outbox" USING btree ("next_attempt_at") WHERE "event_outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "event_outbox_created_idx" ON "event_outbox" USING btree ("created_at");
