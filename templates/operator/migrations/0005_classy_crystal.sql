ALTER TYPE "public"."payment_session_target_type" ADD VALUE 'flight_order' BEFORE 'other';--> statement-breakpoint
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
CREATE TABLE "demo_flight_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"pnr" text,
	"status" text NOT NULL,
	"payer_name" text,
	"payer_email" text,
	"total_amount" text NOT NULL,
	"total_currency" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "person_payment_methods" ADD CONSTRAINT "person_payment_methods_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_person_payment_methods_person" ON "person_payment_methods" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_person_payment_methods_person_default" ON "person_payment_methods" USING btree ("person_id","is_default");--> statement-breakpoint
CREATE INDEX "demo_flight_orders_status_idx" ON "demo_flight_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "demo_flight_orders_created_at_idx" ON "demo_flight_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "demo_flight_orders_payer_email_idx" ON "demo_flight_orders" USING btree ("payer_email");