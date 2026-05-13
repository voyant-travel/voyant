DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'booking_activity_type'
      AND e.enumlabel = 'passenger_update'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'booking_activity_type'
      AND e.enumlabel = 'traveler_update'
  ) THEN
    ALTER TYPE "public"."booking_activity_type" RENAME VALUE 'passenger_update' TO 'traveler_update';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "booking_activity_log"
SET "activity_type" = 'traveler_update'
WHERE "activity_type"::text = 'passenger_update';
