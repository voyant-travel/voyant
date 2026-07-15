import { describe, expect, it } from "vitest"

import {
  bookingExtras,
  bookingsExtrasApiModule,
  bookingsExtrasService,
  extraParticipantSelections,
  slotExtraManifestQuerySchema,
} from "../../src/extras.js"

describe("Bookings extras facade", () => {
  it("exposes booking extra records and slot manifest service methods", () => {
    expect(bookingExtras).toBeDefined()
    expect(extraParticipantSelections).toBeDefined()
    expect(bookingsExtrasService.createBookingExtra).toBeTypeOf("function")
    expect(bookingsExtrasService.getSlotExtraManifest).toBeTypeOf("function")
    expect(bookingsExtrasService.setSlotExtraSelection).toBeTypeOf("function")
  })

  it("owns the legacy extras route mount during the compatibility window", () => {
    expect(bookingsExtrasApiModule.module.name).toBe("bookings-extras")
    expect(slotExtraManifestQuerySchema.parse({}).includeInactiveExtras).toBe(false)
  })
})
