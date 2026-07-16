-- Custom fields had no production adoption at this cutline. Retire the unused
-- EAV value table directly; there is no backfill or compatibility read path.
DROP TABLE IF EXISTS "custom_field_values" CASCADE;
