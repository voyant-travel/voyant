CREATE TABLE "invoice_external_lifecycle_operations" (
	"invoice_id" text NOT NULL,
	"provider" text NOT NULL,
	"operation_id" text NOT NULL,
	"state" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"successor_invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_invoice_external_lifecycle_operations" PRIMARY KEY("invoice_id","provider","operation_id"),
	CONSTRAINT "ck_invoice_external_lifecycle_state" CHECK ("invoice_external_lifecycle_operations"."state" IN ('converted', 'voided')),
	CONSTRAINT "ck_invoice_external_lifecycle_lineage" CHECK (("invoice_external_lifecycle_operations"."state" = 'converted' AND "invoice_external_lifecycle_operations"."successor_invoice_id" IS NOT NULL) OR ("invoice_external_lifecycle_operations"."state" = 'voided' AND "invoice_external_lifecycle_operations"."successor_invoice_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "invoice_external_payment_identifiers" (
	"provider" text NOT NULL,
	"payment_identifier" text NOT NULL,
	"invoice_id" text NOT NULL,
	"first_operation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_invoice_external_payment_identifiers" PRIMARY KEY("provider","payment_identifier")
);
--> statement-breakpoint
CREATE TABLE "invoice_external_settlement_observations" (
	"invoice_id" text NOT NULL,
	"provider" text NOT NULL,
	"operation_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"total_cents" integer NOT NULL,
	"paid_cents" integer NOT NULL,
	"balance_due_cents" integer NOT NULL,
	"payment_identifiers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_invoice_external_settlement_observations" PRIMARY KEY("invoice_id","provider","operation_id"),
	CONSTRAINT "ck_invoice_external_settlement_status" CHECK ("invoice_external_settlement_observations"."status" IN ('partial', 'paid')),
	CONSTRAINT "ck_invoice_external_settlement_totals" CHECK ("invoice_external_settlement_observations"."total_cents" >= 0 AND "invoice_external_settlement_observations"."paid_cents" > 0 AND "invoice_external_settlement_observations"."balance_due_cents" >= 0 AND "invoice_external_settlement_observations"."paid_cents" + "invoice_external_settlement_observations"."balance_due_cents" = "invoice_external_settlement_observations"."total_cents"),
	CONSTRAINT "ck_invoice_external_settlement_state_totals" CHECK (("invoice_external_settlement_observations"."status" = 'partial' AND "invoice_external_settlement_observations"."balance_due_cents" > 0) OR ("invoice_external_settlement_observations"."status" = 'paid' AND "invoice_external_settlement_observations"."balance_due_cents" = 0))
);
--> statement-breakpoint
ALTER TABLE "invoice_external_lifecycle_operations" ADD CONSTRAINT "invoice_external_lifecycle_operations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_external_lifecycle_operations" ADD CONSTRAINT "invoice_external_lifecycle_operations_successor_invoice_id_invoices_id_fk" FOREIGN KEY ("successor_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_external_payment_identifiers" ADD CONSTRAINT "invoice_external_payment_identifiers_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_external_settlement_observations" ADD CONSTRAINT "invoice_external_settlement_observations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_external_lifecycle_current" ON "invoice_external_lifecycle_operations" USING btree ("invoice_id","provider","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_external_payment_identifiers_invoice" ON "invoice_external_payment_identifiers" USING btree ("invoice_id","provider");--> statement-breakpoint
CREATE INDEX "idx_invoice_external_settlement_current" ON "invoice_external_settlement_observations" USING btree ("invoice_id","provider","occurred_at");