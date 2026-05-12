CREATE TABLE IF NOT EXISTS "sharing_group_labels" (
  "group_id" text PRIMARY KEY,
  "label" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "allocation_audit_log" (
  "id" text PRIMARY KEY,
  "slot_id" text NOT NULL REFERENCES "availability_slots"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "actor_id" text,
  "traveler_id" text,
  "resource_id" text,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_allocation_audit_slot_created" ON "allocation_audit_log" USING btree ("slot_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_allocation_audit_traveler" ON "allocation_audit_log" USING btree ("traveler_id");
