ALTER TABLE "booking_traveler_travel_details"
  ADD COLUMN IF NOT EXISTS "sharing_group_id" text,
  ADD COLUMN IF NOT EXISTS "room_type_id" text,
  ADD COLUMN IF NOT EXISTS "bed_preference" text,
  ADD COLUMN IF NOT EXISTS "allocations" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bptd_sharing_group" ON "booking_traveler_travel_details" USING btree ("sharing_group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bptd_room_type" ON "booking_traveler_travel_details" USING btree ("room_type_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "allocation_resources" (
  "id" text PRIMARY KEY NOT NULL,
  "slot_id" text NOT NULL,
  "kind" text NOT NULL,
  "ref_type" text,
  "ref_id" text,
  "label" text,
  "capacity" integer NOT NULL,
  "flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "parent_id" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "allocation_resources" ADD CONSTRAINT "allocation_resources_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_allocation_resources_slot_kind" ON "allocation_resources" USING btree ("slot_id","kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_allocation_resources_parent" ON "allocation_resources" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_allocation_resources_kind_sort" ON "allocation_resources" USING btree ("kind","sort_order","created_at");
