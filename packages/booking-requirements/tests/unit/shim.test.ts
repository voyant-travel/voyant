import { bookingRequirementsService } from "@voyantjs/bookings/requirements"
import { productContactRequirements } from "@voyantjs/bookings/requirements/schema"
import { describe, expect, it } from "vitest"
import { bookingRequirementsService as shimService } from "../../src/index.js"
import { productContactRequirements as shimProductContactRequirements } from "../../src/schema.js"

describe("@voyantjs/booking-requirements compatibility shim", () => {
  it("re-exports the bookings requirements service and schema", () => {
    expect(shimService).toBe(bookingRequirementsService)
    expect(shimProductContactRequirements).toBe(productContactRequirements)
  })
})
