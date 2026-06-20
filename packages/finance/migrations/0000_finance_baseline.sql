DO $$ BEGIN
 CREATE TYPE "public"."ap_service_type" AS ENUM('transport', 'flight', 'accommodation', 'guide', 'meal', 'experience', 'insurance', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."capture_mode" AS ENUM('automatic', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."commission_model" AS ENUM('percentage', 'fixed', 'markup', 'net');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."commission_recipient_type" AS ENUM('channel', 'affiliate', 'agency', 'agent', 'internal', 'supplier', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."commission_status" AS ENUM('pending', 'accrued', 'payable', 'paid', 'void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cost_allocation_split_method" AS ENUM('manual', 'per_pax', 'equal', 'weighted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cost_allocation_target_type" AS ENUM('departure', 'product', 'booking', 'traveler', 'unattributed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."credit_note_status" AS ENUM('draft', 'issued', 'applied');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."guarantee_status" AS ENUM('pending', 'active', 'released', 'failed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."guarantee_type" AS ENUM('deposit', 'credit_card', 'preauth', 'card_on_file', 'bank_transfer', 'voucher', 'agency_letter', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_number_reset_strategy" AS ENUM('never', 'annual', 'monthly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_number_series_scope" AS ENUM('invoice', 'proforma', 'credit_note');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_rendition_format" AS ENUM('html', 'pdf', 'xml', 'json');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_rendition_status" AS ENUM('pending', 'ready', 'failed', 'stale');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending_external_allocation', 'issued', 'partially_paid', 'paid', 'overdue', 'void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_template_body_format" AS ENUM('html', 'markdown', 'lexical_json');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_type" AS ENUM('invoice', 'proforma', 'credit_note');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_authorization_status" AS ENUM('pending', 'authorized', 'partially_captured', 'captured', 'voided', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_capture_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'voided');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_instrument_owner_type" AS ENUM('client', 'supplier', 'channel', 'agency', 'internal', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_instrument_status" AS ENUM('active', 'inactive', 'expired', 'revoked', 'failed_verification');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_instrument_type" AS ENUM('credit_card', 'debit_card', 'bank_account', 'wallet', 'voucher', 'direct_bill', 'cash', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'wallet', 'direct_bill', 'voucher', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_schedule_status" AS ENUM('pending', 'due', 'paid', 'waived', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_schedule_type" AS ENUM('deposit', 'installment', 'balance', 'hold', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_session_status" AS ENUM('pending', 'requires_redirect', 'processing', 'authorized', 'paid', 'failed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_session_target_type" AS ENUM('booking', 'order', 'invoice', 'booking_payment_schedule', 'booking_guarantee', 'flight_order', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."supplier_invoice_status" AS ENUM('draft', 'received', 'approved', 'partially_paid', 'paid', 'disputed', 'void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tax_regime_code" AS ENUM('standard', 'reduced', 'exempt', 'reverse_charge', 'margin_scheme_art311', 'zero_rated', 'out_of_scope', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tax_scope" AS ENUM('included', 'excluded', 'withheld');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."voucher_source_type" AS ENUM('refund', 'cancellation_credit', 'gift', 'manual', 'promo');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."voucher_status" AS ENUM('active', 'redeemed', 'expired', 'void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tax_class_applies_to" AS ENUM('base', 'addon', 'accommodation', 'all');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tax_policy_side" AS ENUM('sell', 'buy');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "booking_guarantees" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"booking_payment_schedule_id" text,
	"booking_item_id" text,
	"guarantee_type" "guarantee_type" NOT NULL,
	"status" "guarantee_status" DEFAULT 'pending' NOT NULL,
	"payment_instrument_id" text,
	"payment_authorization_id" text,
	"currency" text,
	"amount_cents" integer,
	"provider" text,
	"reference_number" text,
	"guaranteed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_booking_guarantees_currency_amount" CHECK (("booking_guarantees"."currency" IS NULL) = ("booking_guarantees"."amount_cents" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "booking_item_commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_item_id" text NOT NULL,
	"channel_id" text,
	"recipient_type" "commission_recipient_type" NOT NULL,
	"commission_model" "commission_model" DEFAULT 'percentage' NOT NULL,
	"currency" text,
	"amount_cents" integer,
	"rate_basis_points" integer,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"payable_at" date,
	"paid_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_booking_item_commissions_currency_amount" CHECK (("booking_item_commissions"."currency" IS NULL) = ("booking_item_commissions"."amount_cents" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "booking_item_tax_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_item_id" text NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"jurisdiction" text,
	"scope" "tax_scope" DEFAULT 'excluded' NOT NULL,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"rate_basis_points" integer,
	"included_in_price" boolean DEFAULT false NOT NULL,
	"remittance_party" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_payment_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"booking_item_id" text,
	"schedule_type" "payment_schedule_type" DEFAULT 'balance' NOT NULL,
	"status" "payment_schedule_status" DEFAULT 'pending' NOT NULL,
	"due_date" date NOT NULL,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
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
CREATE TABLE "invoice_external_refs" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"external_number" text,
	"external_url" text,
	"status" text,
	"metadata" jsonb,
	"synced_at" timestamp with time zone,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_number_series" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"separator" text DEFAULT '' NOT NULL,
	"pad_length" integer DEFAULT 4 NOT NULL,
	"current_sequence" integer DEFAULT 0 NOT NULL,
	"reset_strategy" "invoice_number_reset_strategy" DEFAULT 'never' NOT NULL,
	"reset_at" timestamp with time zone,
	"scope" "invoice_number_series_scope" DEFAULT 'invoice' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"external_provider" text,
	"external_config_key" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_series_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invoice_renditions" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"template_id" text,
	"format" "invoice_rendition_format" DEFAULT 'pdf' NOT NULL,
	"status" "invoice_rendition_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"file_size" integer,
	"checksum" text,
	"language" text,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"jurisdiction" text,
	"body_format" "invoice_template_body_format" DEFAULT 'html' NOT NULL,
	"body" text NOT NULL,
	"css_styles" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_instruments" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_type" "payment_instrument_owner_type" DEFAULT 'client' NOT NULL,
	"person_id" text,
	"organization_id" text,
	"supplier_id" text,
	"channel_id" text,
	"instrument_type" "payment_instrument_type" NOT NULL,
	"status" "payment_instrument_status" DEFAULT 'active' NOT NULL,
	"label" text NOT NULL,
	"provider" text,
	"brand" text,
	"last4" text,
	"holder_name" text,
	"expiry_month" integer,
	"expiry_year" integer,
	"external_token" text,
	"external_customer_id" text,
	"billing_email" text,
	"billing_address" text,
	"direct_bill_reference" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_authorizations" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text,
	"order_id" text,
	"invoice_id" text,
	"booking_guarantee_id" text,
	"payment_instrument_id" text,
	"status" "payment_authorization_status" DEFAULT 'pending' NOT NULL,
	"capture_mode" "capture_mode" DEFAULT 'manual' NOT NULL,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"provider" text,
	"external_authorization_id" text,
	"approval_code" text,
	"authorized_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_authorization_id" text,
	"invoice_id" text,
	"status" "payment_capture_status" DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"provider" text,
	"external_capture_id" text,
	"captured_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"target_type" "payment_session_target_type" DEFAULT 'other' NOT NULL,
	"target_id" text,
	"booking_id" text,
	"order_id" text,
	"invoice_id" text,
	"booking_payment_schedule_id" text,
	"booking_guarantee_id" text,
	"payment_instrument_id" text,
	"payment_authorization_id" text,
	"payment_capture_id" text,
	"payment_id" text,
	"status" "payment_session_status" DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_session_id" text,
	"provider_payment_id" text,
	"external_reference" text,
	"idempotency_key" text,
	"client_reference" text,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"payment_method" "payment_method",
	"payer_person_id" text,
	"payer_organization_id" text,
	"payer_email" text,
	"payer_name" text,
	"redirect_url" text,
	"return_url" text,
	"cancel_url" text,
	"callback_url" text,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"failure_code" text,
	"failure_message" text,
	"notes" text,
	"provider_payload" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_note_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_note_number" text NOT NULL,
	"invoice_id" text NOT NULL,
	"status" "credit_note_status" DEFAULT 'draft' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"base_currency" text,
	"base_amount_cents" integer,
	"fx_rate_set_id" text,
	"reason" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_credit_note_number_unique" UNIQUE("credit_note_number")
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"booking_item_id" text,
	"booking_payment_schedule_id" text,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"tax_rate" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_type" "invoice_type" DEFAULT 'invoice' NOT NULL,
	"converted_from_invoice_id" text,
	"series_id" text,
	"sequence" integer,
	"template_id" text,
	"tax_regime_id" text,
	"language" text,
	"booking_id" text NOT NULL,
	"person_id" text,
	"organization_id" text,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"base_currency" text,
	"fx_rate_set_id" text,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"base_subtotal_cents" integer,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"base_tax_cents" integer,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"base_total_cents" integer,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"base_paid_cents" integer,
	"balance_due_cents" integer DEFAULT 0 NOT NULL,
	"base_balance_due_cents" integer,
	"commission_percent" integer,
	"commission_amount_cents" integer,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"notes" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_invoices_base_currency_amounts" CHECK ((
        "invoices"."base_subtotal_cents" IS NULL
        AND "invoices"."base_tax_cents" IS NULL
        AND "invoices"."base_total_cents" IS NULL
        AND "invoices"."base_paid_cents" IS NULL
        AND "invoices"."base_balance_due_cents" IS NULL
      ) OR "invoices"."base_currency" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"base_currency" text,
	"base_amount_cents" integer,
	"fx_rate_set_id" text,
	"payment_method" "payment_method" NOT NULL,
	"payment_instrument_id" text,
	"payment_authorization_id" text,
	"payment_capture_id" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"reference_number" text,
	"payment_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_payments_base_currency_amount" CHECK (("payments"."base_currency" IS NULL) = ("payments"."base_amount_cents" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "cost_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_cost_allocations" (
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
	CONSTRAINT "ck_supplier_cost_allocations_one_target" CHECK ((
        ("supplier_cost_allocations"."target_type" = 'departure' AND "supplier_cost_allocations"."departure_id" IS NOT NULL AND "supplier_cost_allocations"."product_id" IS NULL AND "supplier_cost_allocations"."booking_id" IS NULL AND "supplier_cost_allocations"."booking_item_id" IS NULL AND "supplier_cost_allocations"."traveler_id" IS NULL)
        OR ("supplier_cost_allocations"."target_type" = 'product' AND "supplier_cost_allocations"."product_id" IS NOT NULL AND "supplier_cost_allocations"."departure_id" IS NULL AND "supplier_cost_allocations"."booking_id" IS NULL AND "supplier_cost_allocations"."booking_item_id" IS NULL AND "supplier_cost_allocations"."traveler_id" IS NULL)
        OR ("supplier_cost_allocations"."target_type" = 'booking' AND "supplier_cost_allocations"."booking_id" IS NOT NULL AND "supplier_cost_allocations"."departure_id" IS NULL AND "supplier_cost_allocations"."product_id" IS NULL AND "supplier_cost_allocations"."traveler_id" IS NULL)
        OR ("supplier_cost_allocations"."target_type" = 'traveler' AND "supplier_cost_allocations"."traveler_id" IS NOT NULL AND "supplier_cost_allocations"."departure_id" IS NULL AND "supplier_cost_allocations"."product_id" IS NULL)
        OR ("supplier_cost_allocations"."target_type" = 'unattributed' AND "supplier_cost_allocations"."departure_id" IS NULL AND "supplier_cost_allocations"."product_id" IS NULL AND "supplier_cost_allocations"."booking_id" IS NULL AND "supplier_cost_allocations"."booking_item_id" IS NULL AND "supplier_cost_allocations"."traveler_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_attachments" (
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
CREATE TABLE "supplier_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"service_type" "ap_service_type" DEFAULT 'other' NOT NULL,
	"cost_category_id" text,
	"supplier_service_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"tax_rate_bps" integer,
	"tax_amount_cents" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
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
	CONSTRAINT "ck_supplier_invoices_base_currency" CHECK ("supplier_invoices"."base_currency" IS NOT NULL OR "supplier_invoices"."fx_rate_set_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text,
	"supplier_id" text,
	"booking_supplier_status_id" text,
	"supplier_invoice_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"base_currency" text,
	"base_amount_cents" integer,
	"fx_rate_set_id" text,
	"payment_method" "payment_method" NOT NULL,
	"payment_instrument_id" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"reference_number" text,
	"payment_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_payments_target" CHECK ("supplier_payments"."booking_id" IS NOT NULL OR "supplier_payments"."supplier_invoice_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "tax_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"default_regime_id" text,
	"lines" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_policy_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_policy_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"side" "tax_policy_side" DEFAULT 'sell' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"name" text NOT NULL,
	"applies_to" "tax_class_applies_to" DEFAULT 'all' NOT NULL,
	"condition" jsonb,
	"tax_regime_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_regimes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" "tax_regime_code" NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" text,
	"rate_percent" integer,
	"description" text,
	"legal_reference" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"voucher_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"payment_id" text,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"series_code" text,
	"status" "voucher_status" DEFAULT 'active' NOT NULL,
	"currency" text NOT NULL,
	"initial_amount_cents" integer NOT NULL,
	"remaining_amount_cents" integer NOT NULL,
	"issued_to_person_id" text,
	"issued_to_organization_id" text,
	"source_type" "voucher_source_type" NOT NULL,
	"source_booking_id" text,
	"source_payment_id" text,
	"valid_from" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"notes" text,
	"issued_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_guarantees" ADD CONSTRAINT "booking_guarantees_booking_payment_schedule_id_booking_payment_schedules_id_fk" FOREIGN KEY ("booking_payment_schedule_id") REFERENCES "public"."booking_payment_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_guarantees" ADD CONSTRAINT "booking_guarantees_payment_instrument_id_payment_instruments_id_fk" FOREIGN KEY ("payment_instrument_id") REFERENCES "public"."payment_instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_guarantees" ADD CONSTRAINT "booking_guarantees_payment_authorization_id_payment_authorizations_id_fk" FOREIGN KEY ("payment_authorization_id") REFERENCES "public"."payment_authorizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_notes" ADD CONSTRAINT "finance_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_attachments" ADD CONSTRAINT "invoice_attachments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_external_refs" ADD CONSTRAINT "invoice_external_refs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_renditions" ADD CONSTRAINT "invoice_renditions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_renditions" ADD CONSTRAINT "invoice_renditions_template_id_invoice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_payment_instrument_id_payment_instruments_id_fk" FOREIGN KEY ("payment_instrument_id") REFERENCES "public"."payment_instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_captures" ADD CONSTRAINT "payment_captures_payment_authorization_id_payment_authorizations_id_fk" FOREIGN KEY ("payment_authorization_id") REFERENCES "public"."payment_authorizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_captures" ADD CONSTRAINT "payment_captures_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_booking_payment_schedule_id_booking_payment_schedules_id_fk" FOREIGN KEY ("booking_payment_schedule_id") REFERENCES "public"."booking_payment_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_booking_guarantee_id_booking_guarantees_id_fk" FOREIGN KEY ("booking_guarantee_id") REFERENCES "public"."booking_guarantees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_payment_instrument_id_payment_instruments_id_fk" FOREIGN KEY ("payment_instrument_id") REFERENCES "public"."payment_instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_payment_authorization_id_payment_authorizations_id_fk" FOREIGN KEY ("payment_authorization_id") REFERENCES "public"."payment_authorizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_payment_capture_id_payment_captures_id_fk" FOREIGN KEY ("payment_capture_id") REFERENCES "public"."payment_captures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_booking_payment_schedule_id_booking_payment_schedules_id_fk" FOREIGN KEY ("booking_payment_schedule_id") REFERENCES "public"."booking_payment_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_instrument_id_payment_instruments_id_fk" FOREIGN KEY ("payment_instrument_id") REFERENCES "public"."payment_instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_authorization_id_payment_authorizations_id_fk" FOREIGN KEY ("payment_authorization_id") REFERENCES "public"."payment_authorizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_capture_id_payment_captures_id_fk" FOREIGN KEY ("payment_capture_id") REFERENCES "public"."payment_captures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_cost_allocations" ADD CONSTRAINT "supplier_cost_allocations_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_cost_allocations" ADD CONSTRAINT "supplier_cost_allocations_supplier_invoice_line_id_supplier_invoice_lines_id_fk" FOREIGN KEY ("supplier_invoice_line_id") REFERENCES "public"."supplier_invoice_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_attachments" ADD CONSTRAINT "supplier_invoice_attachments_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_cost_category_id_cost_categories_id_fk" FOREIGN KEY ("cost_category_id") REFERENCES "public"."cost_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_payment_instrument_id_payment_instruments_id_fk" FOREIGN KEY ("payment_instrument_id") REFERENCES "public"."payment_instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_booking" ON "booking_guarantees" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_booking_created" ON "booking_guarantees" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_schedule" ON "booking_guarantees" USING btree ("booking_payment_schedule_id");--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_item" ON "booking_guarantees" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_instrument" ON "booking_guarantees" USING btree ("payment_instrument_id");--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_authorization" ON "booking_guarantees" USING btree ("payment_authorization_id");--> statement-breakpoint
CREATE INDEX "idx_booking_guarantees_status" ON "booking_guarantees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_booking_item_commissions_item" ON "booking_item_commissions" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_booking_item_commissions_item_created" ON "booking_item_commissions" USING btree ("booking_item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_booking_item_commissions_channel" ON "booking_item_commissions" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_booking_item_commissions_status" ON "booking_item_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_booking_item_tax_lines_item" ON "booking_item_tax_lines" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_booking_item_tax_lines_item_sort_created" ON "booking_item_tax_lines" USING btree ("booking_item_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_booking_item_tax_lines_scope" ON "booking_item_tax_lines" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_booking_payment_schedules_booking" ON "booking_payment_schedules" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_payment_schedules_booking_due_created" ON "booking_payment_schedules" USING btree ("booking_id","due_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_booking_payment_schedules_item" ON "booking_payment_schedules" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_booking_payment_schedules_status" ON "booking_payment_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_booking_payment_schedules_due_date" ON "booking_payment_schedules" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_finance_notes_invoice" ON "finance_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_finance_notes_invoice_created" ON "finance_notes" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_attachments_invoice" ON "invoice_attachments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_attachments_invoice_created" ON "invoice_attachments" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_external_refs_invoice" ON "invoice_external_refs" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_external_refs_invoice_created" ON "invoice_external_refs" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_external_refs_provider" ON "invoice_external_refs" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoice_external_refs_invoice_provider" ON "invoice_external_refs" USING btree ("invoice_id","provider");--> statement-breakpoint
CREATE INDEX "idx_invoice_number_series_scope" ON "invoice_number_series" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_invoice_number_series_active" ON "invoice_number_series" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_invoice_number_series_scope_default" ON "invoice_number_series" USING btree ("scope","is_default");--> statement-breakpoint
CREATE INDEX "idx_invoice_number_series_external_provider" ON "invoice_number_series" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "idx_invoice_number_series_scope_updated" ON "invoice_number_series" USING btree ("scope","updated_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_number_series_active_updated" ON "invoice_number_series" USING btree ("active","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_invoice_number_series_default_scope_active" ON "invoice_number_series" USING btree ("scope") WHERE "invoice_number_series"."active" = true AND "invoice_number_series"."is_default" = true;--> statement-breakpoint
CREATE INDEX "idx_invoice_renditions_invoice" ON "invoice_renditions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_renditions_invoice_created" ON "invoice_renditions" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_renditions_template" ON "invoice_renditions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_renditions_status" ON "invoice_renditions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoice_renditions_format" ON "invoice_renditions" USING btree ("format");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_language" ON "invoice_templates" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_language_updated" ON "invoice_templates" USING btree ("language","updated_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_jurisdiction" ON "invoice_templates" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_jurisdiction_updated" ON "invoice_templates" USING btree ("jurisdiction","updated_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_default" ON "invoice_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_default_updated" ON "invoice_templates" USING btree ("is_default","updated_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_active" ON "invoice_templates" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_invoice_templates_active_updated" ON "invoice_templates" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_owner_type" ON "payment_instruments" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_owner_type_updated" ON "payment_instruments" USING btree ("owner_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_person" ON "payment_instruments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_person_updated" ON "payment_instruments" USING btree ("person_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_organization" ON "payment_instruments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_organization_updated" ON "payment_instruments" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_supplier" ON "payment_instruments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_supplier_updated" ON "payment_instruments" USING btree ("supplier_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_channel" ON "payment_instruments" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_channel_updated" ON "payment_instruments" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_status" ON "payment_instruments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_status_updated" ON "payment_instruments" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_type" ON "payment_instruments" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_payment_instruments_type_updated" ON "payment_instruments" USING btree ("instrument_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_booking" ON "payment_authorizations" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_booking_created" ON "payment_authorizations" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_order" ON "payment_authorizations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_order_created" ON "payment_authorizations" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_invoice" ON "payment_authorizations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_invoice_created" ON "payment_authorizations" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_guarantee" ON "payment_authorizations" USING btree ("booking_guarantee_id");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_guarantee_created" ON "payment_authorizations" USING btree ("booking_guarantee_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_instrument" ON "payment_authorizations" USING btree ("payment_instrument_id");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_instrument_created" ON "payment_authorizations" USING btree ("payment_instrument_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_status" ON "payment_authorizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_authorizations_status_created" ON "payment_authorizations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_captures_authorization" ON "payment_captures" USING btree ("payment_authorization_id");--> statement-breakpoint
CREATE INDEX "idx_payment_captures_authorization_created" ON "payment_captures" USING btree ("payment_authorization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_captures_invoice" ON "payment_captures" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_captures_invoice_created" ON "payment_captures" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_captures_status" ON "payment_captures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_captures_status_created" ON "payment_captures" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_target" ON "payment_sessions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_target_created" ON "payment_sessions" USING btree ("target_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_booking" ON "payment_sessions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_booking_created" ON "payment_sessions" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_order" ON "payment_sessions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_order_created" ON "payment_sessions" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_invoice" ON "payment_sessions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_invoice_created" ON "payment_sessions" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_schedule" ON "payment_sessions" USING btree ("booking_payment_schedule_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_schedule_created" ON "payment_sessions" USING btree ("booking_payment_schedule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_guarantee" ON "payment_sessions" USING btree ("booking_guarantee_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_guarantee_created" ON "payment_sessions" USING btree ("booking_guarantee_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_status" ON "payment_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_status_created" ON "payment_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_provider" ON "payment_sessions" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_provider_created" ON "payment_sessions" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_provider_session" ON "payment_sessions" USING btree ("provider_session_id");--> statement-breakpoint
CREATE INDEX "idx_payment_sessions_expires_at" ON "payment_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_payment_sessions_idempotency" ON "payment_sessions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_payment_sessions_provider_session" ON "payment_sessions" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_line_items_credit_note" ON "credit_note_line_items" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_line_items_credit_note_sort" ON "credit_note_line_items" USING btree ("credit_note_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_invoice" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_invoice_created" ON "credit_notes" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_fx_rate_set" ON "credit_notes" USING btree ("fx_rate_set_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_number" ON "credit_notes" USING btree ("credit_note_number");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_sort" ON "invoice_line_items" USING btree ("invoice_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_booking_item" ON "invoice_line_items" USING btree ("booking_item_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_payment_schedule" ON "invoice_line_items" USING btree ("booking_payment_schedule_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_booking" ON "invoices" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_booking_created" ON "invoices" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_person" ON "invoices" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_organization" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_status_created" ON "invoices" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_outstanding_due" ON "invoices" USING btree ("status","balance_due_cents","due_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_created" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_fx_rate_set" ON "invoices" USING btree ("fx_rate_set_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_number" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_type_active_idx" ON "invoices" USING btree ("invoice_number","invoice_type") WHERE "invoices"."status" <> 'void';--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_converted_from" ON "invoices" USING btree ("converted_from_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice_date" ON "payments" USING btree ("invoice_id","payment_date");--> statement-breakpoint
CREATE INDEX "idx_payments_fx_rate_set" ON "payments" USING btree ("fx_rate_set_id");--> statement-breakpoint
CREATE INDEX "idx_payments_instrument" ON "payments" USING btree ("payment_instrument_id");--> statement-breakpoint
CREATE INDEX "idx_payments_authorization" ON "payments" USING btree ("payment_authorization_id");--> statement-breakpoint
CREATE INDEX "idx_payments_capture" ON "payments" USING btree ("payment_capture_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_cost_categories_sort" ON "cost_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_supplier_cost_allocations_invoice" ON "supplier_cost_allocations" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_cost_allocations_line" ON "supplier_cost_allocations" USING btree ("supplier_invoice_line_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_cost_allocations_departure" ON "supplier_cost_allocations" USING btree ("departure_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_cost_allocations_product" ON "supplier_cost_allocations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_cost_allocations_booking" ON "supplier_cost_allocations" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoice_attachments_invoice" ON "supplier_invoice_attachments" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoice_attachments_invoice_created" ON "supplier_invoice_attachments" USING btree ("supplier_invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoice_lines_invoice" ON "supplier_invoice_lines" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoice_lines_invoice_sort" ON "supplier_invoice_lines" USING btree ("supplier_invoice_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoice_lines_service_type" ON "supplier_invoice_lines" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_supplier" ON "supplier_invoices" USING btree ("supplier_id") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_supplier_created" ON "supplier_invoices" USING btree ("supplier_id","created_at") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_status" ON "supplier_invoices" USING btree ("status") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_status_created" ON "supplier_invoices" USING btree ("status","created_at") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_due_date" ON "supplier_invoices" USING btree ("due_date") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_fx_rate_set" ON "supplier_invoices" USING btree ("fx_rate_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_supplier_number_active_idx" ON "supplier_invoices" USING btree ("supplier_id","supplier_invoice_no") WHERE "supplier_invoices"."status" <> 'void' AND "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_booking" ON "supplier_payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_booking_created" ON "supplier_payments" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_supplier" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_supplier_created" ON "supplier_payments" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_fx_rate_set" ON "supplier_payments" USING btree ("fx_rate_set_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_instrument" ON "supplier_payments" USING btree ("payment_instrument_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_status" ON "supplier_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_status_created" ON "supplier_payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_date" ON "supplier_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_supplier_invoice" ON "supplier_payments" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_tax_classes_code" ON "tax_classes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_tax_classes_active" ON "tax_classes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_profiles_code" ON "tax_policy_profiles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_profiles_active" ON "tax_policy_profiles" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_rules_profile" ON "tax_policy_rules" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_rules_profile_side_priority" ON "tax_policy_rules" USING btree ("profile_id","side","priority");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_rules_active" ON "tax_policy_rules" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_tax_regimes_code" ON "tax_regimes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_tax_regimes_code_updated" ON "tax_regimes" USING btree ("code","updated_at");--> statement-breakpoint
CREATE INDEX "idx_tax_regimes_jurisdiction" ON "tax_regimes" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "idx_tax_regimes_jurisdiction_updated" ON "tax_regimes" USING btree ("jurisdiction","updated_at");--> statement-breakpoint
CREATE INDEX "idx_tax_regimes_active" ON "tax_regimes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_tax_regimes_active_updated" ON "tax_regimes" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemptions_voucher" ON "voucher_redemptions" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemptions_booking" ON "voucher_redemptions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemptions_voucher_created" ON "voucher_redemptions" USING btree ("voucher_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_vouchers_code" ON "vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_vouchers_series" ON "vouchers" USING btree ("series_code");--> statement-breakpoint
CREATE INDEX "idx_vouchers_status" ON "vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vouchers_person" ON "vouchers" USING btree ("issued_to_person_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_organization" ON "vouchers" USING btree ("issued_to_organization_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_source_booking" ON "vouchers" USING btree ("source_booking_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_valid_from" ON "vouchers" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "idx_vouchers_expires_at" ON "vouchers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_vouchers_remaining" ON "vouchers" USING btree ("remaining_amount_cents");