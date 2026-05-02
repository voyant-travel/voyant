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
CREATE INDEX "demo_flight_orders_status_idx" ON "demo_flight_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "demo_flight_orders_created_at_idx" ON "demo_flight_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "demo_flight_orders_payer_email_idx" ON "demo_flight_orders" USING btree ("payer_email");