DELETE FROM "custom_field_definitions";--> statement-breakpoint
CREATE TYPE "public"."custom_field_owner_kind" AS ENUM('platform', 'operator', 'app');--> statement-breakpoint
CREATE TYPE "public"."custom_field_lifecycle_state" AS ENUM('active', 'inactive', 'deprecated');--> statement-breakpoint
ALTER TABLE "custom_field_definitions"
  ADD COLUMN "namespace" text NOT NULL,
  ADD COLUMN "owner_kind" "custom_field_owner_kind" NOT NULL,
  ADD COLUMN "owner_id" text,
  ADD COLUMN "lifecycle_state" "custom_field_lifecycle_state" NOT NULL,
  ADD COLUMN "provenance" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_definitions"
  ADD CONSTRAINT "custom_field_definitions_owner_identity"
  CHECK (
    ("owner_kind" = 'operator' AND "owner_id" IS NULL AND "namespace" = 'custom')
    OR (
      "owner_kind" = 'platform'
      AND "owner_id" IS NOT NULL
      AND "namespace" <> 'custom'
      AND "namespace" NOT LIKE 'app--%'
    )
    OR (
      "owner_kind" = 'app'
      AND "owner_id" IS NOT NULL
      AND "namespace" LIKE 'app--%'
    )
  );--> statement-breakpoint
DROP INDEX "uidx_custom_field_definitions_key";--> statement-breakpoint
CREATE INDEX "idx_custom_field_definitions_owner"
  ON "custom_field_definitions" USING btree ("owner_kind", "owner_id", "lifecycle_state");--> statement-breakpoint
CREATE INDEX "idx_custom_field_definitions_namespace"
  ON "custom_field_definitions" USING btree ("namespace", "entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_custom_field_definitions_namespace_key"
  ON "custom_field_definitions" USING btree ("entity_type", "namespace", "key");
