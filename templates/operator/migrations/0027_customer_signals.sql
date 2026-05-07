CREATE TYPE "public"."customer_signal_kind" AS ENUM('wishlist', 'notify', 'inquiry', 'request_offer', 'referral');
--> statement-breakpoint
CREATE TYPE "public"."customer_signal_source" AS ENUM('form', 'phone', 'admin', 'abandoned_cart', 'website', 'booking');
--> statement-breakpoint
CREATE TYPE "public"."customer_signal_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost', 'expired');
--> statement-breakpoint
CREATE TABLE "customer_signals" (
  "id" text PRIMARY KEY NOT NULL,
  "person_id" text NOT NULL,
  "product_id" text,
  "option_unit_id" text,
  "kind" "customer_signal_kind" NOT NULL,
  "source" "customer_signal_source" NOT NULL,
  "status" "customer_signal_status" DEFAULT 'new' NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL,
  "notes" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "assigned_to_user_id" text,
  "follow_up_at" timestamp with time zone,
  "resolved_booking_id" text,
  "source_submission_id" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_signals"
  ADD CONSTRAINT "customer_signals_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."people"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_customer_signals_person_status_created"
  ON "customer_signals" USING btree ("person_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "idx_customer_signals_assignee_status"
  ON "customer_signals" USING btree ("assigned_to_user_id", "status");
--> statement-breakpoint
CREATE INDEX "idx_customer_signals_kind"
  ON "customer_signals" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "idx_customer_signals_resolved_booking"
  ON "customer_signals" USING btree ("resolved_booking_id");
