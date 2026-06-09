CREATE TYPE "public"."quote_version_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'superseded', 'expired');--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DATA TYPE "public"."quote_version_status" USING (
  CASE "status"::text
    WHEN 'rejected' THEN 'declined'
    WHEN 'archived' THEN 'superseded'
    ELSE "status"::text
  END
)::"public"."quote_version_status";--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."quote_version_status";--> statement-breakpoint
DROP TYPE "public"."quote_status";--> statement-breakpoint
ALTER TYPE "public"."opportunity_status" RENAME TO "quote_status";--> statement-breakpoint
ALTER TABLE "pipelines" ALTER COLUMN "entity_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "activity_links" ALTER COLUMN "entity_type" SET DATA TYPE text USING "entity_type"::text;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ALTER COLUMN "entity_type" SET DATA TYPE text USING "entity_type"::text;--> statement-breakpoint
ALTER TABLE "custom_field_values" ALTER COLUMN "entity_type" SET DATA TYPE text USING "entity_type"::text;--> statement-breakpoint
ALTER TABLE "pipelines" ALTER COLUMN "entity_type" SET DATA TYPE text USING "entity_type"::text;--> statement-breakpoint
UPDATE "activity_links" SET "entity_type" = 'quote' WHERE "entity_type" = 'opportunity';--> statement-breakpoint
UPDATE "custom_field_definitions" SET "entity_type" = 'quote' WHERE "entity_type" = 'opportunity';--> statement-breakpoint
UPDATE "custom_field_values" SET "entity_type" = 'quote' WHERE "entity_type" = 'opportunity';--> statement-breakpoint
UPDATE "pipelines" SET "entity_type" = 'quote' WHERE "entity_type" = 'opportunity';--> statement-breakpoint
DROP TYPE "public"."entity_type";--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('organization', 'person', 'quote', 'activity');--> statement-breakpoint
ALTER TABLE "activity_links" ALTER COLUMN "entity_type" SET DATA TYPE "public"."entity_type" USING "entity_type"::"public"."entity_type";--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ALTER COLUMN "entity_type" SET DATA TYPE "public"."entity_type" USING "entity_type"::"public"."entity_type";--> statement-breakpoint
ALTER TABLE "custom_field_values" ALTER COLUMN "entity_type" SET DATA TYPE "public"."entity_type" USING "entity_type"::"public"."entity_type";--> statement-breakpoint
ALTER TABLE "pipelines" ALTER COLUMN "entity_type" SET DATA TYPE "public"."entity_type" USING "entity_type"::"public"."entity_type";--> statement-breakpoint
ALTER TABLE "pipelines" ALTER COLUMN "entity_type" SET DEFAULT 'quote'::"public"."entity_type";--> statement-breakpoint
ALTER TABLE "quotes" RENAME TO "quote_versions";--> statement-breakpoint
ALTER TABLE "quote_versions" RENAME CONSTRAINT "quotes_pkey" TO "quote_versions_pkey";--> statement-breakpoint
ALTER INDEX "idx_quotes_opportunity" RENAME TO "idx_quote_versions_quote";--> statement-breakpoint
ALTER INDEX "idx_quotes_status" RENAME TO "idx_quote_versions_status";--> statement-breakpoint
ALTER INDEX "idx_quotes_opportunity_updated" RENAME TO "idx_quote_versions_quote_updated";--> statement-breakpoint
ALTER INDEX "idx_quotes_status_updated" RENAME TO "idx_quote_versions_status_updated";--> statement-breakpoint
ALTER TABLE "opportunities" RENAME TO "quotes";--> statement-breakpoint
ALTER TABLE "quotes" RENAME CONSTRAINT "opportunities_pkey" TO "quotes_pkey";--> statement-breakpoint
ALTER INDEX "idx_opportunities_person" RENAME TO "idx_quotes_person";--> statement-breakpoint
ALTER INDEX "idx_opportunities_org" RENAME TO "idx_quotes_org";--> statement-breakpoint
ALTER INDEX "idx_opportunities_pipeline" RENAME TO "idx_quotes_pipeline";--> statement-breakpoint
ALTER INDEX "idx_opportunities_stage" RENAME TO "idx_quotes_stage";--> statement-breakpoint
ALTER INDEX "idx_opportunities_owner" RENAME TO "idx_quotes_owner";--> statement-breakpoint
ALTER INDEX "idx_opportunities_status" RENAME TO "idx_quotes_status";--> statement-breakpoint
ALTER INDEX "idx_opportunities_person_updated" RENAME TO "idx_quotes_person_updated";--> statement-breakpoint
ALTER INDEX "idx_opportunities_org_updated" RENAME TO "idx_quotes_org_updated";--> statement-breakpoint
ALTER INDEX "idx_opportunities_pipeline_updated" RENAME TO "idx_quotes_pipeline_updated";--> statement-breakpoint
ALTER INDEX "idx_opportunities_stage_updated" RENAME TO "idx_quotes_stage_updated";--> statement-breakpoint
ALTER INDEX "idx_opportunities_owner_updated" RENAME TO "idx_quotes_owner_updated";--> statement-breakpoint
ALTER INDEX "idx_opportunities_status_updated" RENAME TO "idx_quotes_status_updated";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_version_id" text;--> statement-breakpoint
CREATE INDEX "idx_quotes_accepted_version" ON "quotes" USING btree ("accepted_version_id");--> statement-breakpoint
ALTER TABLE "quotes" RENAME CONSTRAINT "opportunities_person_id_people_id_fk" TO "quotes_person_id_people_id_fk";--> statement-breakpoint
ALTER TABLE "quotes" RENAME CONSTRAINT "opportunities_organization_id_organizations_id_fk" TO "quotes_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "quotes" RENAME CONSTRAINT "opportunities_pipeline_id_pipelines_id_fk" TO "quotes_pipeline_id_pipelines_id_fk";--> statement-breakpoint
ALTER TABLE "quotes" RENAME CONSTRAINT "opportunities_stage_id_stages_id_fk" TO "quotes_stage_id_stages_id_fk";--> statement-breakpoint
ALTER TABLE "quote_versions" RENAME COLUMN "opportunity_id" TO "quote_id";--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "supersedes_id" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "trip_snapshot_id" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_versions" RENAME CONSTRAINT "quotes_opportunity_id_opportunities_id_fk" TO "quote_versions_quote_id_quotes_id_fk";--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_supersedes_id_quote_versions_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."quote_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quote_versions_supersedes" ON "quote_versions" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "idx_quote_versions_trip_snapshot" ON "quote_versions" USING btree ("trip_snapshot_id");--> statement-breakpoint
ALTER TABLE "opportunity_participants" RENAME TO "quote_participants";--> statement-breakpoint
ALTER TABLE "quote_participants" RENAME CONSTRAINT "opportunity_participants_pkey" TO "quote_participants_pkey";--> statement-breakpoint
ALTER TABLE "quote_participants" RENAME COLUMN "opportunity_id" TO "quote_id";--> statement-breakpoint
ALTER TABLE "quote_participants" RENAME CONSTRAINT "opportunity_participants_opportunity_id_opportunities_id_fk" TO "quote_participants_quote_id_quotes_id_fk";--> statement-breakpoint
ALTER TABLE "quote_participants" RENAME CONSTRAINT "opportunity_participants_person_id_people_id_fk" TO "quote_participants_person_id_people_id_fk";--> statement-breakpoint
ALTER INDEX "idx_opportunity_participants_opportunity" RENAME TO "idx_quote_participants_quote";--> statement-breakpoint
ALTER INDEX "idx_opportunity_participants_opportunity_primary" RENAME TO "idx_quote_participants_quote_primary";--> statement-breakpoint
ALTER INDEX "idx_opportunity_participants_person" RENAME TO "idx_quote_participants_person";--> statement-breakpoint
ALTER INDEX "uidx_opportunity_participants_unique" RENAME TO "uidx_quote_participants_unique";--> statement-breakpoint
ALTER TABLE "opportunity_products" RENAME TO "quote_products";--> statement-breakpoint
ALTER TABLE "quote_products" RENAME CONSTRAINT "opportunity_products_pkey" TO "quote_products_pkey";--> statement-breakpoint
ALTER TABLE "quote_products" RENAME COLUMN "opportunity_id" TO "quote_id";--> statement-breakpoint
ALTER TABLE "quote_products" RENAME CONSTRAINT "opportunity_products_opportunity_id_opportunities_id_fk" TO "quote_products_quote_id_quotes_id_fk";--> statement-breakpoint
ALTER INDEX "idx_opportunity_products_opportunity" RENAME TO "idx_quote_products_quote";--> statement-breakpoint
ALTER INDEX "idx_opportunity_products_opportunity_created" RENAME TO "idx_quote_products_quote_created";--> statement-breakpoint
ALTER INDEX "idx_opportunity_products_product" RENAME TO "idx_quote_products_product";--> statement-breakpoint
ALTER INDEX "idx_opportunity_products_supplier_service" RENAME TO "idx_quote_products_supplier_service";--> statement-breakpoint
ALTER TABLE "quote_lines" RENAME TO "quote_version_lines";--> statement-breakpoint
ALTER TABLE "quote_version_lines" RENAME CONSTRAINT "quote_lines_pkey" TO "quote_version_lines_pkey";--> statement-breakpoint
ALTER TABLE "quote_version_lines" RENAME COLUMN "quote_id" TO "quote_version_id";--> statement-breakpoint
ALTER TABLE "quote_version_lines" RENAME CONSTRAINT "quote_lines_quote_id_quotes_id_fk" TO "quote_version_lines_quote_version_id_quote_versions_id_fk";--> statement-breakpoint
ALTER INDEX "idx_quote_lines_quote" RENAME TO "idx_quote_version_lines_version";--> statement-breakpoint
ALTER INDEX "idx_quote_lines_quote_created" RENAME TO "idx_quote_version_lines_version_created";--> statement-breakpoint
ALTER INDEX "idx_quote_lines_product" RENAME TO "idx_quote_version_lines_product";--> statement-breakpoint
ALTER INDEX "idx_quote_lines_supplier_service" RENAME TO "idx_quote_version_lines_supplier_service";--> statement-breakpoint
ALTER INDEX "idx_bcd_quote" RENAME TO "idx_bcd_quote_version_tmp";--> statement-breakpoint
ALTER INDEX "idx_bcd_opportunity" RENAME TO "idx_bcd_quote";--> statement-breakpoint
ALTER INDEX "idx_bcd_quote_version_tmp" RENAME TO "idx_bcd_quote_version";--> statement-breakpoint
ALTER TABLE "booking_crm_details" RENAME COLUMN "quote_id" TO "quote_version_id";--> statement-breakpoint
ALTER TABLE "booking_crm_details" RENAME COLUMN "opportunity_id" TO "quote_id";--> statement-breakpoint
ALTER INDEX "idx_offers_quote_created" RENAME TO "idx_offers_quote_version_created_tmp";--> statement-breakpoint
ALTER INDEX "idx_offers_opportunity_created" RENAME TO "idx_offers_quote_created";--> statement-breakpoint
ALTER INDEX "idx_offers_quote_version_created_tmp" RENAME TO "idx_offers_quote_version_created";--> statement-breakpoint
ALTER TABLE "offers" RENAME COLUMN "quote_id" TO "quote_version_id";--> statement-breakpoint
ALTER TABLE "offers" RENAME COLUMN "opportunity_id" TO "quote_id";--> statement-breakpoint
ALTER INDEX "idx_orders_quote_created" RENAME TO "idx_orders_quote_version_created_tmp";--> statement-breakpoint
ALTER INDEX "idx_orders_opportunity_created" RENAME TO "idx_orders_quote_created";--> statement-breakpoint
ALTER INDEX "idx_orders_quote_version_created_tmp" RENAME TO "idx_orders_quote_version_created";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "quote_id" TO "quote_version_id";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "opportunity_id" TO "quote_id";
