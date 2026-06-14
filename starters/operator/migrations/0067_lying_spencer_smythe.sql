CREATE TYPE "public"."legal_target_kind" AS ENUM('booking', 'quote_version', 'program', 'product', 'inventory_item', 'supplier_channel_relationship', 'provider_source_ref');--> statement-breakpoint
CREATE TYPE "public"."legal_term_acceptance_status" AS ENUM('not_required', 'pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."legal_term_type" AS ENUM('terms_and_conditions', 'cancellation', 'guarantee', 'payment', 'pricing', 'commission', 'other');--> statement-breakpoint
CREATE TABLE "legal_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text,
	"policy_version_id" text,
	"target_kind" "legal_target_kind",
	"target_id" text,
	"target_provider" text,
	"target_source_ref" text,
	"legacy_transaction_offer_id" text,
	"legacy_transaction_order_id" text,
	"term_type" "legal_term_type" DEFAULT 'terms_and_conditions' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"language" text,
	"required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"acceptance_status" "legal_term_acceptance_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" RENAME COLUMN "order_id" TO "legacy_transaction_order_id";--> statement-breakpoint
ALTER TABLE "policy_acceptances" RENAME COLUMN "offer_id" TO "legacy_transaction_offer_id";--> statement-breakpoint
ALTER TABLE "policy_acceptances" RENAME COLUMN "order_id" TO "legacy_transaction_order_id";--> statement-breakpoint
DROP INDEX "idx_contracts_order";--> statement-breakpoint
DROP INDEX "idx_contracts_order_created";--> statement-breakpoint
DROP INDEX "idx_policy_acceptances_order";--> statement-breakpoint
DROP INDEX "idx_policy_acceptances_offer";--> statement-breakpoint
DROP INDEX "idx_policy_acceptances_order_accepted";--> statement-breakpoint
ALTER TABLE "contract_attachments" ADD COLUMN "target_kind" "legal_target_kind";--> statement-breakpoint
ALTER TABLE "contract_attachments" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "contract_attachments" ADD COLUMN "target_provider" text;--> statement-breakpoint
ALTER TABLE "contract_attachments" ADD COLUMN "target_source_ref" text;--> statement-breakpoint
ALTER TABLE "contract_attachments" ADD COLUMN "legacy_transaction_offer_id" text;--> statement-breakpoint
ALTER TABLE "contract_attachments" ADD COLUMN "legacy_transaction_order_id" text;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD COLUMN "target_kind" "legal_target_kind";--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD COLUMN "target_provider" text;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD COLUMN "target_source_ref" text;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD COLUMN "legacy_transaction_offer_id" text;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD COLUMN "legacy_transaction_order_id" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "target_kind" "legal_target_kind";--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "target_provider" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "target_source_ref" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "legacy_transaction_offer_id" text;--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD COLUMN "target_kind" "legal_target_kind";--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD COLUMN "target_provider" text;--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD COLUMN "target_source_ref" text;--> statement-breakpoint
UPDATE "contracts"
SET "target_kind" = 'booking', "target_id" = "booking_id"
WHERE "booking_id" IS NOT NULL AND "target_kind" IS NULL AND "target_id" IS NULL;--> statement-breakpoint
UPDATE "policy_acceptances"
SET "target_kind" = 'booking', "target_id" = "booking_id"
WHERE "booking_id" IS NOT NULL AND "target_kind" IS NULL AND "target_id" IS NULL;--> statement-breakpoint
UPDATE "contract_signatures"
SET
	"target_kind" = "contracts"."target_kind",
	"target_id" = "contracts"."target_id",
	"target_provider" = "contracts"."target_provider",
	"target_source_ref" = "contracts"."target_source_ref",
	"legacy_transaction_offer_id" = "contracts"."legacy_transaction_offer_id",
	"legacy_transaction_order_id" = "contracts"."legacy_transaction_order_id"
FROM "contracts"
WHERE "contract_signatures"."contract_id" = "contracts"."id";--> statement-breakpoint
UPDATE "contract_attachments"
SET
	"target_kind" = "contracts"."target_kind",
	"target_id" = "contracts"."target_id",
	"target_provider" = "contracts"."target_provider",
	"target_source_ref" = "contracts"."target_source_ref",
	"legacy_transaction_offer_id" = "contracts"."legacy_transaction_offer_id",
	"legacy_transaction_order_id" = "contracts"."legacy_transaction_order_id"
FROM "contracts"
WHERE "contract_attachments"."contract_id" = "contracts"."id";--> statement-breakpoint
INSERT INTO "legal_terms" (
	"id",
	"legacy_transaction_offer_id",
	"legacy_transaction_order_id",
	"term_type",
	"title",
	"body",
	"language",
	"required",
	"sort_order",
	"acceptance_status",
	"accepted_at",
	"accepted_by",
	"metadata",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"offer_id",
	"order_id",
	"term_type"::text::"legal_term_type",
	"title",
	"body",
	"language",
	"required",
	"sort_order",
	"acceptance_status"::text::"legal_term_acceptance_status",
	"accepted_at",
	"accepted_by",
	"metadata",
	"created_at",
	"updated_at"
FROM "order_terms"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "legal_terms" ADD CONSTRAINT "legal_terms_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_terms" ADD CONSTRAINT "legal_terms_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_legal_terms_contract_sort" ON "legal_terms" USING btree ("contract_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_policy_version_sort" ON "legal_terms" USING btree ("policy_version_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_target_sort" ON "legal_terms" USING btree ("target_kind","target_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_provider_source_sort" ON "legal_terms" USING btree ("target_provider","target_source_ref","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_legacy_transaction_offer_sort" ON "legal_terms" USING btree ("legacy_transaction_offer_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_legacy_transaction_order_sort" ON "legal_terms" USING btree ("legacy_transaction_order_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_type_sort" ON "legal_terms" USING btree ("term_type","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_legal_terms_acceptance_sort" ON "legal_terms" USING btree ("acceptance_status","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_contract_attachments_target" ON "contract_attachments" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "idx_contract_attachments_provider_source" ON "contract_attachments" USING btree ("target_provider","target_source_ref");--> statement-breakpoint
CREATE INDEX "idx_contract_attachments_legacy_transaction_offer" ON "contract_attachments" USING btree ("legacy_transaction_offer_id");--> statement-breakpoint
CREATE INDEX "idx_contract_attachments_legacy_transaction_order" ON "contract_attachments" USING btree ("legacy_transaction_order_id");--> statement-breakpoint
CREATE INDEX "idx_contract_signatures_target" ON "contract_signatures" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "idx_contract_signatures_provider_source" ON "contract_signatures" USING btree ("target_provider","target_source_ref");--> statement-breakpoint
CREATE INDEX "idx_contract_signatures_legacy_transaction_offer" ON "contract_signatures" USING btree ("legacy_transaction_offer_id");--> statement-breakpoint
CREATE INDEX "idx_contract_signatures_legacy_transaction_order" ON "contract_signatures" USING btree ("legacy_transaction_order_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_target" ON "contracts" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_provider_source" ON "contracts" USING btree ("target_provider","target_source_ref");--> statement-breakpoint
CREATE INDEX "idx_contracts_legacy_transaction_offer" ON "contracts" USING btree ("legacy_transaction_offer_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_legacy_transaction_order" ON "contracts" USING btree ("legacy_transaction_order_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_target_created" ON "contracts" USING btree ("target_kind","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_policy_acceptances_target" ON "policy_acceptances" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "idx_policy_acceptances_provider_source" ON "policy_acceptances" USING btree ("target_provider","target_source_ref");--> statement-breakpoint
CREATE INDEX "idx_policy_acceptances_legacy_transaction_offer" ON "policy_acceptances" USING btree ("legacy_transaction_offer_id");--> statement-breakpoint
CREATE INDEX "idx_policy_acceptances_legacy_transaction_order" ON "policy_acceptances" USING btree ("legacy_transaction_order_id");--> statement-breakpoint
CREATE INDEX "idx_policy_acceptances_target_accepted" ON "policy_acceptances" USING btree ("target_kind","target_id","accepted_at");
