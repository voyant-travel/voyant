CREATE TABLE IF NOT EXISTS "invoice_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "invoice_id" text NOT NULL,
  "kind" text DEFAULT 'supporting_document' NOT NULL,
  "name" text NOT NULL,
  "mime_type" text,
  "file_size" integer,
  "storage_key" text,
  "checksum" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_attachments_invoice_id_invoices_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_attachments_invoice"
  ON "invoice_attachments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_attachments_invoice_created"
  ON "invoice_attachments" USING btree ("invoice_id","created_at");
