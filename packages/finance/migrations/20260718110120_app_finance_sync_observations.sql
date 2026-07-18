CREATE TABLE "invoice_external_sync_observations" (
	"invoice_id" text NOT NULL,
	"provider" text NOT NULL,
	"operation_id" text NOT NULL,
	"status" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_invoice_external_sync_observations" PRIMARY KEY("invoice_id","provider","operation_id")
);
--> statement-breakpoint
ALTER TABLE "invoice_external_sync_observations" ADD CONSTRAINT "invoice_external_sync_observations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_external_sync_observations_current" ON "invoice_external_sync_observations" USING btree ("invoice_id","provider","occurred_at");