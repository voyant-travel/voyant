ALTER TABLE "invoice_external_refs" ADD COLUMN "sync_state" text;--> statement-breakpoint
ALTER TABLE "invoice_external_refs" ADD COLUMN "sync_operation_id" text;--> statement-breakpoint
ALTER TABLE "invoice_external_refs" ADD COLUMN "sync_occurred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_external_refs" ADD COLUMN "sync_error_code" text;--> statement-breakpoint
ALTER TABLE "invoice_external_refs" ADD COLUMN "sync_error_message" text;--> statement-breakpoint
ALTER TABLE "invoice_external_refs" ADD COLUMN "sync_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_renditions" ADD COLUMN "app_provider" text;--> statement-breakpoint
ALTER TABLE "invoice_renditions" ADD COLUMN "app_idempotency_digest" text;--> statement-breakpoint
ALTER TABLE "invoice_renditions" ADD COLUMN "app_file_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_renditions_app_idempotency" ON "invoice_renditions" USING btree ("invoice_id","app_provider","app_idempotency_digest");
