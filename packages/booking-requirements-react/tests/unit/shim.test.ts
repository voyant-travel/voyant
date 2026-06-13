import { bookingRequirementsQueryKeys } from "@voyantjs/bookings-react/requirements"
import { describe, expect, it } from "vitest"
import { bookingRequirementsQueryKeys as shimQueryKeys } from "../../src/index.js"

describe("@voyantjs/booking-requirements-react compatibility shim", () => {
  it("re-exports the bookings-react requirements query keys", () => {
    expect(shimQueryKeys).toBe(bookingRequirementsQueryKeys)
  })
})
