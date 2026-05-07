CREATE TYPE "public"."person_document_type" AS ENUM('passport', 'id_card', 'driver_license', 'visa', 'other');
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "accessibility_encrypted" jsonb;
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "dietary_encrypted" jsonb;
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "loyalty_encrypted" jsonb;
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "insurance_encrypted" jsonb;
--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "documents_encrypted";
--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "accessibility_encrypted";
--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "dietary_encrypted";
--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "loyalty_encrypted";
--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "insurance_encrypted";
--> statement-breakpoint
CREATE TABLE "person_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "person_id" text NOT NULL,
  "type" "person_document_type" NOT NULL,
  "number_encrypted" jsonb,
  "issuing_authority" text,
  "issuing_country" text,
  "issue_date" date,
  "expiry_date" date,
  "attachment_id" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_documents"
  ADD CONSTRAINT "person_documents_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."people"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_person_documents_person"
  ON "person_documents" USING btree ("person_id");
--> statement-breakpoint
CREATE INDEX "idx_person_documents_person_type"
  ON "person_documents" USING btree ("person_id","type");
--> statement-breakpoint
CREATE INDEX "idx_person_documents_expiry"
  ON "person_documents" USING btree ("expiry_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_person_documents_primary_per_type"
  ON "person_documents" USING btree ("person_id","type")
  WHERE "is_primary" = true;
--> statement-breakpoint
ALTER TABLE "booking_traveler_travel_details" ADD COLUMN "passport_person_document_id" text;
