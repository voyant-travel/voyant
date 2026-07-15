CREATE TABLE "notification_delivery_requests" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"request_fingerprint" text NOT NULL,
	"delivery_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_delivery_requests_delivery_id_notification_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_notification_delivery_requests_delivery" ON "notification_delivery_requests" USING btree ("delivery_id");
