CREATE TABLE IF NOT EXISTS "legal_contract_bookings_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"bookings_booking_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
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
CREATE TABLE IF NOT EXISTS "legal_policyAcceptance_bookings_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_policyAcceptance_id" text NOT NULL,
	"bookings_booking_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
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
CREATE TABLE IF NOT EXISTS "legal_contract_relationships_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"relationships_organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_contract_relationships_person" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"relationships_person_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_contract_suppliers_supplier" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_contract_id" text NOT NULL,
	"suppliers_supplier_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_bookings_booking_pair_idx" ON "legal_contract_bookings_booking" USING btree ("legal_contract_id","bookings_booking_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_bookings_booking_l_uniq" ON "legal_contract_bookings_booking" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_bookings_booking_r_idx" ON "legal_contract_bookings_booking" USING btree ("bookings_booking_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_finance_invoice_pair_idx" ON "legal_contract_finance_invoice" USING btree ("legal_contract_id","finance_invoice_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_finance_invoice_l_idx" ON "legal_contract_finance_invoice" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_finance_invoice_r_uniq" ON "legal_contract_finance_invoice" USING btree ("finance_invoice_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_policyAcceptance_bookings_booking_pair_idx" ON "legal_policyAcceptance_bookings_booking" USING btree ("legal_policyAcceptance_id","bookings_booking_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_policyAcceptance_bookings_booking_l_uniq" ON "legal_policyAcceptance_bookings_booking" USING btree ("legal_policyAcceptance_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_policyAcceptance_bookings_booking_r_idx" ON "legal_policyAcceptance_bookings_booking" USING btree ("bookings_booking_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_policy_products_product_pair_idx" ON "legal_policy_products_product" USING btree ("legal_policy_id","products_product_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_policy_products_product_l_idx" ON "legal_policy_products_product" USING btree ("legal_policy_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_policy_products_product_r_idx" ON "legal_policy_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_relationships_organization_pair_idx" ON "legal_contract_relationships_organization" USING btree ("legal_contract_id","relationships_organization_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_relationships_organization_l_uniq" ON "legal_contract_relationships_organization" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_relationships_organization_r_idx" ON "legal_contract_relationships_organization" USING btree ("relationships_organization_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_relationships_person_pair_idx" ON "legal_contract_relationships_person" USING btree ("legal_contract_id","relationships_person_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_relationships_person_l_uniq" ON "legal_contract_relationships_person" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_relationships_person_r_idx" ON "legal_contract_relationships_person" USING btree ("relationships_person_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_suppliers_supplier_pair_idx" ON "legal_contract_suppliers_supplier" USING btree ("legal_contract_id","suppliers_supplier_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legal_contract_suppliers_supplier_l_uniq" ON "legal_contract_suppliers_supplier" USING btree ("legal_contract_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_contract_suppliers_supplier_r_idx" ON "legal_contract_suppliers_supplier" USING btree ("suppliers_supplier_id") WHERE "deleted_at" IS NULL;
