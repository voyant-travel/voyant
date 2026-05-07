CREATE TYPE "public"."person_relationship_kind" AS ENUM('spouse', 'partner', 'parent', 'child', 'sibling', 'guardian', 'ward', 'emergency_contact', 'friend', 'travel_companion', 'other');
--> statement-breakpoint
CREATE TABLE "person_relationships" (
  "id" text PRIMARY KEY NOT NULL,
  "from_person_id" text NOT NULL,
  "to_person_id" text NOT NULL,
  "kind" "person_relationship_kind" NOT NULL,
  "inverse_kind" "person_relationship_kind",
  "start_date" date,
  "end_date" date,
  "is_primary" boolean DEFAULT false NOT NULL,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "person_relationships_no_self" CHECK ("from_person_id" <> "to_person_id")
);
--> statement-breakpoint
ALTER TABLE "person_relationships"
  ADD CONSTRAINT "person_relationships_from_person_id_people_id_fk"
  FOREIGN KEY ("from_person_id") REFERENCES "public"."people"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "person_relationships"
  ADD CONSTRAINT "person_relationships_to_person_id_people_id_fk"
  FOREIGN KEY ("to_person_id") REFERENCES "public"."people"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_person_relationships_from"
  ON "person_relationships" USING btree ("from_person_id");
--> statement-breakpoint
CREATE INDEX "idx_person_relationships_to"
  ON "person_relationships" USING btree ("to_person_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_person_relationships_pair_kind"
  ON "person_relationships" USING btree ("from_person_id", "to_person_id", "kind");
