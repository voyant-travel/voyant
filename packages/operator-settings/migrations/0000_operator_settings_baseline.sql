CREATE TABLE "booking_tax_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tax_price_mode" text DEFAULT 'inclusive' NOT NULL,
	"tax_policy_profile_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_payment_defaults" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_payment_policy" jsonb,
	"booking_checkout_url_template" text,
	"invoice_pay_url_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_payment_instructions" (
	"id" text PRIMARY KEY NOT NULL,
	"bank_transfer_beneficiary" text,
	"iban" text,
	"bank" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"legal_name" text,
	"vat_id" text,
	"registration_number" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"license" text,
	"license_authority" text,
	"signatory_name" text,
	"signatory_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"legal_name" text,
	"vat_id" text,
	"registration_number" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"iban" text,
	"bank" text,
	"license" text,
	"license_authority" text,
	"signatory_name" text,
	"signatory_role" text,
	"customer_payment_policy" jsonb,
	"tax_price_mode" text DEFAULT 'inclusive' NOT NULL,
	"tax_policy_profile_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
