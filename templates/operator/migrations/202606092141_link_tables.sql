-- Generated link table migration.
-- Link tables are deployment-owned cross-module associations and intentionally have no cross-package foreign keys.
CREATE TABLE IF NOT EXISTS "crm_person_products_product" (
	"id" text PRIMARY KEY NOT NULL,
	"crm_person_id" text NOT NULL,
	"products_product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_person_products_product_pair_idx" ON "crm_person_products_product" USING btree ("crm_person_id", "products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_person_products_product_l_idx" ON "crm_person_products_product" USING btree ("crm_person_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_person_products_product_r_uniq" ON "crm_person_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_organization_products_product" (
	"id" text PRIMARY KEY NOT NULL,
	"crm_organization_id" text NOT NULL,
	"products_product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_organization_products_product_pair_idx" ON "crm_organization_products_product" USING btree ("crm_organization_id", "products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_organization_products_product_l_idx" ON "crm_organization_products_product" USING btree ("crm_organization_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_organization_products_product_r_uniq" ON "crm_organization_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_contract_bookings_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"bookings_booking_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_bookings_booking_pair_idx" ON "legal_contract_bookings_booking" USING btree ("legal_contract_id", "bookings_booking_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_bookings_booking_l_uniq" ON "legal_contract_bookings_booking" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_bookings_booking_r_idx" ON "legal_contract_bookings_booking" USING btree ("bookings_booking_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_contract_transactions_order" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"transactions_order_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_transactions_order_pair_idx" ON "legal_contract_transactions_order" USING btree ("legal_contract_id", "transactions_order_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_transactions_order_l_uniq" ON "legal_contract_transactions_order" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_transactions_order_r_idx" ON "legal_contract_transactions_order" USING btree ("transactions_order_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_contract_finance_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"finance_invoice_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_finance_invoice_pair_idx" ON "legal_contract_finance_invoice" USING btree ("legal_contract_id", "finance_invoice_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_finance_invoice_l_idx" ON "legal_contract_finance_invoice" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_finance_invoice_r_uniq" ON "legal_contract_finance_invoice" USING btree ("finance_invoice_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_policy_products_product" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_policy_id" text NOT NULL,
	"products_product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_policy_products_product_pair_idx" ON "legal_policy_products_product" USING btree ("legal_policy_id", "products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_policy_products_product_l_idx" ON "legal_policy_products_product" USING btree ("legal_policy_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_policy_products_product_r_idx" ON "legal_policy_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_policyAcceptance_bookings_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_policyAcceptance_id" text NOT NULL,
	"bookings_booking_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_policyAcceptance_bookings_booking_pair_idx" ON "legal_policyAcceptance_bookings_booking" USING btree ("legal_policyAcceptance_id", "bookings_booking_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_policyAcceptance_bookings_booking_l_uniq" ON "legal_policyAcceptance_bookings_booking" USING btree ("legal_policyAcceptance_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_policyAcceptance_bookings_booking_r_idx" ON "legal_policyAcceptance_bookings_booking" USING btree ("bookings_booking_id") WHERE "deleted_at" IS NULL;
