-- custom-fields unification (phase 4): retire the EAV value side table.
-- GUARDED: refuse to drop while rows remain, so a deployment that hasn't run the
-- backfill (starters/operator/scripts/backfill-custom-fields.ts --clear) fails
-- the migration instead of silently losing data. Empty (backfilled) → drops.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "custom_field_values") THEN
    RAISE EXCEPTION 'custom_field_values still has rows — run scripts/backfill-custom-fields.ts --clear (copies values to each entity''s custom_fields column and clears the table) before upgrading, or the data will be lost.';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE "custom_field_values" CASCADE;
