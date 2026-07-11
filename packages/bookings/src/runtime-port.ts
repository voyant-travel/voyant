import type { BootstrapContext } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"

import type { BookingsHonoModuleOptions } from "./index.js"
import type { BookingRequirementsHonoModuleOptions } from "./requirements/index.js"

export interface BookingsRuntimeProvider {
  options: BookingsHonoModuleOptions
  registerWorkflowService?(context: BootstrapContext): Promise<void> | void
}

export const bookingsRuntimePort = definePort<BookingsRuntimeProvider>({
  id: "bookings.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object" || !provider.options) {
      throw new Error("bookings.runtime provider must supply module options.")
    }
    if (
      provider.registerWorkflowService !== undefined &&
      typeof provider.registerWorkflowService !== "function"
    ) {
      throw new Error("bookings.runtime registerWorkflowService must be a function.")
    }
  },
})

export const bookingRequirementsRuntimePort = definePort<BookingRequirementsHonoModuleOptions>({
  id: "bookings.requirements.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("bookings.requirements.runtime provider must be an options object.")
    }
  },
})
