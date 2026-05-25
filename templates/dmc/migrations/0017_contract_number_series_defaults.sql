ALTER TABLE "contract_number_series" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_number_series" ADD COLUMN IF NOT EXISTS "external_provider" text;--> statement-breakpoint
ALTER TABLE "contract_number_series" ADD COLUMN IF NOT EXISTS "external_config_key" text;--> statement-breakpoint

WITH sole_active_scopes AS (
  SELECT "scope", max("id") AS "id"
  FROM "contract_number_series"
  WHERE "active" = true
  GROUP BY "scope"
  HAVING count(*) = 1
)
UPDATE "contract_number_series"
SET "is_default" = true, "updated_at" = now()
WHERE "id" IN (SELECT "id" FROM sole_active_scopes)
  AND NOT EXISTS (
    SELECT 1
    FROM "contract_number_series" existing_default
    WHERE existing_default."scope" = "contract_number_series"."scope"
      AND existing_default."active" = true
      AND existing_default."is_default" = true
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_contract_number_series_scope_default" ON "contract_number_series" USING btree ("scope","is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contract_number_series_external_provider" ON "contract_number_series" USING btree ("external_provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_contract_number_series_default_scope_active" ON "contract_number_series" USING btree ("scope") WHERE active = true AND is_default = true;
