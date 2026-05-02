-- Trimmed: the rest of the diff between 0000 and current schema was already
-- applied to the live DB via `drizzle-kit push` (charter / hospitality / stay
-- tables). Re-applying it would conflict on existing types like
-- charter_booking_mode. The 0001_snapshot.json still describes the full
-- intended state so future migrations diff from a correct baseline.
ALTER TABLE "people" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "gender" text;
