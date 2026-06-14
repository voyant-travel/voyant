-- Second-pass backfill for booking_items.availability_slot_id.
--
-- The first backfill (0027) only looked at booking_allocations. The
-- catalog booking-engine writes the slot id into
-- booking_items.metadata->>'availabilitySlotId' but doesn't always
-- create a booking_allocations row, so most existing rows still had
-- availability_slot_id NULL. Pull from metadata, then re-run the
-- slot-derived label + timing backfills.

UPDATE "booking_items"
SET "availability_slot_id" = "metadata"->>'availabilitySlotId'
WHERE "availability_slot_id" IS NULL
  AND "metadata" ? 'availabilitySlotId'
  AND "metadata"->>'availabilitySlotId' IS NOT NULL;--> statement-breakpoint

-- Re-run the departure label backfill for any rows that just gained
-- an availability_slot_id from metadata.
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

-- Re-run the slot-derived timing backfill for newly-linked rows.
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
