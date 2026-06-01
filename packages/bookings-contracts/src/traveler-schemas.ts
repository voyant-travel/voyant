import { z } from "zod"

/**
 * Pure traveler validation primitives shared by the bookings validation
 * surface and the runtime `bookingTravelerTravelDetails` Drizzle schema. They
 * live here (zod-only) so the contract surface stays free of the data layer;
 * `@voyantjs/bookings/schema/travel-details` re-exports them.
 */

export const bookingTravelerBedPreferenceSchema = z.enum([
  "single",
  "twin",
  "double",
  "no-preference",
])

export const travelerAllocationMapSchema = z.record(z.string(), z.string())
