CREATE TABLE IF NOT EXISTS "checkout_finalizations" (
  "booking_id" text PRIMARY KEY NOT NULL,
  "trigger_payment_session_id" text NOT NULL,
  "invoice_id" text,
  "payment_id" text,
  "confirmed_at" timestamp with time zone,
  "payment_revision" integer DEFAULT 0 NOT NULL,
  "contract_id" text,
  "contract_attachment_id" text,
  "final_payment_render_version" integer DEFAULT 0 NOT NULL,
  "final_payment_render_key" text,
  "revision" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checkout_finalizations_trigger_session"
  ON "checkout_finalizations" USING btree ("trigger_payment_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checkout_finalizations_invoice"
  ON "checkout_finalizations" USING btree ("invoice_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_finalization_deliveries" (
  "payment_session_id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL,
  "payment_linked_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_finalization_deliveries_booking_id_checkout_finalizations_booking_id_fk"
    FOREIGN KEY ("booking_id") REFERENCES "public"."checkout_finalizations"("booking_id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checkout_finalization_deliveries_booking"
  ON "checkout_finalization_deliveries" USING btree ("booking_id");
