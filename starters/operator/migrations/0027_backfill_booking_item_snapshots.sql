-- Backfill catalog snapshots onto existing booking_items rows. Each
-- UPDATE is wrapped in DO $$ ... EXCEPTION WHEN undefined_table $$ so
-- the migration is a no-op for the source table on catalog-less
-- deployments (OTA). Snapshots are only filled when currently NULL —
-- the snapshot is meant to be authoritative-at-create-time, so we
-- never overwrite a value that's already there.

DO $$ BEGIN
  UPDATE "booking_items" bi
  SET "product_name_snapshot" = p."name"
  FROM "products" p
  WHERE bi."product_id" = p."id"
    AND bi."product_name_snapshot" IS NULL
    AND bi."product_id" IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  UPDATE "booking_items" bi
  SET "option_name_snapshot" = o."name"
  FROM "product_options" o
  WHERE bi."option_id" = o."id"
    AND bi."option_name_snapshot" IS NULL
    AND bi."option_id" IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  UPDATE "booking_items" bi
  SET "unit_name_snapshot" = u."name"
  FROM "option_units" u
  WHERE bi."option_unit_id" = u."id"
    AND bi."unit_name_snapshot" IS NULL
    AND bi."option_unit_id" IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint

-- Pull availability_slot_id forward from booking_allocations. Only
-- copies when exactly one allocation exists per item — multi-slot
-- items don't get a single canonical slot, and the operator can fix
-- those by hand.
DO $$ BEGIN
  UPDATE "booking_items" bi
  SET "availability_slot_id" = a."availability_slot_id"
  FROM (
    SELECT "booking_item_id", MIN("availability_slot_id") AS "availability_slot_id"
    FROM "booking_allocations"
    WHERE "availability_slot_id" IS NOT NULL
    GROUP BY "booking_item_id"
    HAVING COUNT(DISTINCT "availability_slot_id") = 1
  ) a
  WHERE bi."id" = a."booking_item_id"
    AND bi."availability_slot_id" IS NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint

-- Departure label derived from the slot's local timezone. Format
-- matches the Intl.DateTimeFormat output in service.ts as closely as
-- Postgres allows (e.g. "May 28 2026 09:00").
DO $$ BEGIN
  UPDATE "booking_items" bi
  SET "departure_label_snapshot" = to_char(
    timezone(s."timezone", s."starts_at"),
    'Mon FMDD YYYY HH24:MI'
  )
  FROM "availability_slots" s
  WHERE bi."availability_slot_id" = s."id"
    AND bi."departure_label_snapshot" IS NULL
    AND bi."availability_slot_id" IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint

-- Mirror slot timing onto the item where the item is missing it. The
-- service writes both columns going forward, so only legacy rows
-- benefit. Same null-only guard.
DO $$ BEGIN
  UPDATE "booking_items" bi
  SET
    "starts_at" = COALESCE(bi."starts_at", s."starts_at"),
    "ends_at" = COALESCE(bi."ends_at", s."ends_at"),
    "service_date" = COALESCE(bi."service_date", s."date_local")
  FROM "availability_slots" s
  WHERE bi."availability_slot_id" = s."id"
    AND bi."availability_slot_id" IS NOT NULL
    AND (
      bi."starts_at" IS NULL
      OR bi."ends_at" IS NULL
      OR bi."service_date" IS NULL
    );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
