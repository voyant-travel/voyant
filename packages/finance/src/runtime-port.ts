import { definePort } from "@voyant-travel/core/project"

import type { BookingTaxRouteOptions } from "./booking-tax.js"
import type { FinanceHonoModuleOptions } from "./index.js"
import type { BookingScheduleRoutesOptions } from "./payment-schedule/routes.js"

function optionsPort<T extends object>(id: string) {
  return definePort<T>({
    id,
    test(provider) {
      if (provider === null || typeof provider !== "object") {
        throw new Error(`${id} provider must be an options object.`)
      }
    },
  })
}

export const financeRuntimePort = optionsPort<FinanceHonoModuleOptions>("finance.runtime")
export const financeBookingScheduleRuntimePort = optionsPort<BookingScheduleRoutesOptions>(
  "finance.booking-schedule.runtime",
)
export const financeBookingTaxRuntimePort = optionsPort<BookingTaxRouteOptions>(
  "finance.booking-tax.runtime",
)
