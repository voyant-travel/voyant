-- `person_directory` is a Postgres VIEW exposing each person's primary
-- email / phone / website by LATERAL lookup against `identity_contact_points`.
-- It is declared `.existing()` in the relationships schema, so drizzle-kit
-- never emits it — this custom migration carries the DDL into the framework
-- bundle (the D.1 cutover dropped it; it previously lived only in the retired
-- legacy operator baseline). CREATE OR REPLACE keeps it idempotent for
-- deployments that imported the legacy baseline (which already have the view).
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
