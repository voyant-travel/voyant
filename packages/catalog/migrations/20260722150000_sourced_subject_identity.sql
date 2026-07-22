-- Existing releases allowed more than one connectionless row for the same
-- provider identity because Postgres treats NULL values as distinct in unique
-- indexes. Do not guess at rewriting those durable IDs here: referenced
-- subjects can also be stored in vertical-owned reverse-reference tables that
-- this package migration is not authorized to mutate.
--
-- The diagnostic chooses the canonical ID deterministically (oldest
-- first_seen_at, then created_at, then row id). Operators must preserve that
-- ID, repoint every listed duplicate in Catalog and vertical-owned references,
-- then remove or explicitly retire the duplicate sourced-entry rows.
DO $$
DECLARE
  identity_conflicts jsonb;
  identity_conflict_count bigint;
BEGIN
  SELECT count(*)
  INTO identity_conflict_count
  FROM (
    SELECT 1
    FROM "catalog_sourced_entries"
    WHERE "source_ref" IS NOT NULL
    GROUP BY "entity_module", "source_kind", "source_connection_id", "source_ref"
    HAVING count(*) > 1
  ) AS duplicate_groups;

  IF identity_conflict_count > 0 THEN
    SELECT jsonb_agg(to_jsonb(conflict_group))
    INTO identity_conflicts
    FROM (
      SELECT
        "entity_module",
        "source_kind",
        "source_connection_id",
        "source_ref",
        (array_agg("entity_id" ORDER BY "first_seen_at", "created_at", "id"))[1]
          AS canonical_entity_id,
        array_agg("entity_id" ORDER BY "first_seen_at", "created_at", "id")
          AS entity_ids
      FROM "catalog_sourced_entries"
      WHERE "source_ref" IS NOT NULL
      GROUP BY "entity_module", "source_kind", "source_connection_id", "source_ref"
      HAVING count(*) > 1
      ORDER BY "entity_module", "source_kind", "source_connection_id" NULLS FIRST, "source_ref"
      LIMIT 25
    ) AS conflict_group;

    RAISE EXCEPTION USING
      MESSAGE = format(
        'Cannot enforce sourced presentation-subject identity: %s duplicate provider identity group(s) require reconciliation',
        identity_conflict_count
      ),
      DETAIL = identity_conflicts::text,
      HINT = 'For each group preserve canonical_entity_id; repoint duplicate entity IDs in catalog_overlay, catalog_overlay_history, booking_catalog_snapshot, catalog_quotes, booking_drafts, search documents, and vertical-owned reverse references; then remove or retire duplicate catalog_sourced_entries rows and rerun this migration.';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "catalog_sourced_entries_source_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_sourced_entries_source_connected_uniq" ON "catalog_sourced_entries" USING btree ("entity_module","source_kind","source_connection_id","source_ref") WHERE "source_connection_id" IS NOT NULL AND "source_ref" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_sourced_entries_source_connectionless_uniq" ON "catalog_sourced_entries" USING btree ("entity_module","source_kind","source_ref") WHERE "source_connection_id" IS NULL AND "source_ref" IS NOT NULL;
