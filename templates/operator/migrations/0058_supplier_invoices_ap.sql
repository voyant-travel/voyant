-- Accounts payable: supplier invoices, cost allocations, configurable cost
-- categories, and end-to-end FX base-amount snapshots (#1506).
-- Idempotent (mirrors the repo's IF NOT EXISTS migration style) so it is safe on
-- environments where the schema was already applied via `drizzle-kit push`.

DO $$ BEGIN
  CREATE TYPE "public"."supplier_invoice_status" AS ENUM('draft', 'received', 'approved', 'partially_paid', 'paid', 'disputed', 'void');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."ap_service_type" AS ENUM('transport', 'flight', 'accommodation', 'guide', 'meal', 'experience', 'insurance', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cost_allocation_target_type" AS ENUM('departure', 'product', 'booking', 'traveler', 'unattributed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cost_allocation_split_method" AS ENUM('manual', 'per_pax', 'equal', 'weighted');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_invoice_no" text NOT NULL,
	"internal_ref" text,
	"status" "supplier_invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"base_currency" text,
	"fx_rate_set_id" text,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"base_subtotal_cents" integer,
	"base_tax_cents" integer,
	"base_total_cents" integer,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"balance_due_cents" integer DEFAULT 0 NOT NULL,
	"tax_regime_id" text,
	"issue_date" date NOT NULL,
	"due_date" date,
	"received_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"storage_key" text,
	"extraction_id" text,
	"notes" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_supplier_invoices_base_currency" CHECK ("base_currency" IS NOT NULL OR "fx_rate_set_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"service_type" "ap_service_type" DEFAULT 'other' NOT NULL,
	"supplier_service_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"tax_rate_bps" integer,
	"tax_amount_cents" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"cost_category_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_cost_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_invoice_id" text NOT NULL,
	"supplier_invoice_line_id" text,
	"target_type" "cost_allocation_target_type" NOT NULL,
	"departure_id" text,
	"product_id" text,
	"booking_id" text,
	"booking_item_id" text,
	"traveler_id" text,
	"amount_cents" integer NOT NULL,
	"base_amount_cents" integer,
	"split_method" "cost_allocation_split_method" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_cost_allocations_one_target" CHECK (
		(target_type = 'departure' AND departure_id IS NOT NULL AND product_id IS NULL AND booking_id IS NULL AND booking_item_id IS NULL AND traveler_id IS NULL)
		OR (target_type = 'product' AND product_id IS NOT NULL AND departure_id IS NULL AND booking_id IS NULL AND booking_item_id IS NULL AND traveler_id IS NULL)
		OR (target_type = 'booking' AND booking_id IS NOT NULL AND departure_id IS NULL AND product_id IS NULL AND traveler_id IS NULL)
		OR (target_type = 'traveler' AND traveler_id IS NOT NULL AND departure_id IS NULL AND product_id IS NULL)
		OR (target_type = 'unattributed' AND departure_id IS NULL AND product_id IS NULL AND booking_id IS NULL AND booking_item_id IS NULL AND traveler_id IS NULL)
	)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_invoice_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_invoice_id" text NOT NULL,
	"kind" text DEFAULT 'supporting_document' NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"storage_key" text,
	"checksum" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- AP additions to existing tables --------------------------------------------
ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "supplier_invoice_id" text;
--> statement-breakpoint
ALTER TABLE "supplier_payments" ALTER COLUMN "booking_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_supplier_statuses" ADD COLUMN IF NOT EXISTS "supplier_id" text;
--> statement-breakpoint
ALTER TABLE "booking_supplier_statuses" ADD COLUMN IF NOT EXISTS "supplier_invoice_line_id" text;
--> statement-breakpoint
-- Foreign keys (finance-local only; cross-module refs stay as plain text) -----
DO $$ BEGIN
  ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_cost_category_id_fkey" FOREIGN KEY ("cost_category_id") REFERENCES "public"."cost_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_cost_allocations" ADD CONSTRAINT "supplier_cost_allocations_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_cost_allocations" ADD CONSTRAINT "supplier_cost_allocations_supplier_invoice_line_id_fkey" FOREIGN KEY ("supplier_invoice_line_id") REFERENCES "public"."supplier_invoice_lines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_invoice_attachments" ADD CONSTRAINT "supplier_invoice_attachments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_payments" ADD CONSTRAINT "ck_supplier_payments_booking_or_invoice" CHECK ("booking_id" IS NOT NULL OR "supplier_invoice_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Indexes --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_cost_categories_sort" ON "cost_categories" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_supplier" ON "supplier_invoices" USING btree ("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_supplier_created" ON "supplier_invoices" USING btree ("supplier_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_status" ON "supplier_invoices" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_status_created" ON "supplier_invoices" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_due_date" ON "supplier_invoices" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_fx_rate_set" ON "supplier_invoices" USING btree ("fx_rate_set_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoices_supplier_number_active_idx" ON "supplier_invoices" USING btree ("supplier_id", "supplier_invoice_no") WHERE ("status" <> 'void' AND "deleted_at" IS NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoice_lines_invoice" ON "supplier_invoice_lines" USING btree ("supplier_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoice_lines_invoice_sort" ON "supplier_invoice_lines" USING btree ("supplier_invoice_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoice_lines_service_type" ON "supplier_invoice_lines" USING btree ("service_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_cost_allocations_invoice" ON "supplier_cost_allocations" USING btree ("supplier_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_cost_allocations_line" ON "supplier_cost_allocations" USING btree ("supplier_invoice_line_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_cost_allocations_departure" ON "supplier_cost_allocations" USING btree ("departure_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_cost_allocations_product" ON "supplier_cost_allocations" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_cost_allocations_booking" ON "supplier_cost_allocations" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoice_attachments_invoice" ON "supplier_invoice_attachments" USING btree ("supplier_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_invoice_attachments_invoice_created" ON "supplier_invoice_attachments" USING btree ("supplier_invoice_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supplier_payments_supplier_invoice" ON "supplier_payments" USING btree ("supplier_invoice_id");
