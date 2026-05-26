ALTER TABLE "invoice_line_items" ADD COLUMN "booking_payment_schedule_id" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_booking_schedule_id_fk" FOREIGN KEY ("booking_payment_schedule_id") REFERENCES "public"."booking_payment_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_payment_schedule" ON "invoice_line_items" USING btree ("booking_payment_schedule_id");
