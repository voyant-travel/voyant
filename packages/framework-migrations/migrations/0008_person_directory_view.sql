-- Ship the `person_directory` view in the framework bundle.
--
-- `personDirectoryView` (packages/relationships/src/schema-accounts.ts) is a
-- drizzle `pgView(...).existing()`, so drizzle-kit never emits its DDL into the
-- generated bundle — the same gap that `SEED_EXTENSIONS` / the extensions
-- preamble fills for pg_trgm/unaccent. Without this migration a schema-derived
-- operator DB (one built from the framework bundle rather than copied from a
-- starter baseline) has no `person_directory` view, and every relationships
-- read that hydrates contact points fails with 42P01. See issue #1971.
--
-- CREATE OR REPLACE keeps it idempotent: the column list is unchanged from the
-- original baseline view, so a DB that already has it is a no-op.
CREATE OR REPLACE VIEW "person_directory" AS
SELECT
  p."id" AS "person_id",
  email_cp."value" AS "email",
  phone_cp."value" AS "phone",
  website_cp."value" AS "website"
FROM "people" p
LEFT JOIN LATERAL (
  SELECT "value"
  FROM "identity_contact_points"
  WHERE "entity_type" = 'person'
    AND "entity_id" = p."id"
    AND "kind" = 'email'
  ORDER BY "is_primary" DESC, "created_at"
  LIMIT 1
) email_cp ON TRUE
LEFT JOIN LATERAL (
  SELECT "value"
  FROM "identity_contact_points"
  WHERE "entity_type" = 'person'
    AND "entity_id" = p."id"
    AND "kind" = 'phone'
  ORDER BY "is_primary" DESC, "created_at"
  LIMIT 1
) phone_cp ON TRUE
LEFT JOIN LATERAL (
  SELECT "value"
  FROM "identity_contact_points"
  WHERE "entity_type" = 'person'
    AND "entity_id" = p."id"
    AND "kind" = 'website'
  ORDER BY "is_primary" DESC, "created_at"
  LIMIT 1
) website_cp ON TRUE;
