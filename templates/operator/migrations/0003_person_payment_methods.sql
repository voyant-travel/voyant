CREATE TABLE "person_payment_methods" (
  "id" text PRIMARY KEY NOT NULL,
  "person_id" text NOT NULL,
  "brand" text NOT NULL,
  "last4" text,
  "holder_name" text,
  "exp_month" integer,
  "exp_year" integer,
  "processor_token" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_payment_methods"
  ADD CONSTRAINT "person_payment_methods_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."people"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_person_payment_methods_person"
  ON "person_payment_methods" USING btree ("person_id");
--> statement-breakpoint
CREATE INDEX "idx_person_payment_methods_person_default"
  ON "person_payment_methods" USING btree ("person_id","is_default");
