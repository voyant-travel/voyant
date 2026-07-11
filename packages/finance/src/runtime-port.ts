import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

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
export interface FinanceBookingScheduleRuntime {
  options: BookingScheduleRoutesOptions
  withDb<T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
}

export const financeBookingScheduleRuntimePort = definePort<FinanceBookingScheduleRuntime>({
  id: "finance.booking-schedule.runtime",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      !provider.options ||
      typeof provider.withDb !== "function"
    ) {
      throw new Error("finance.booking-schedule.runtime provider must supply options and withDb().")
    }
  },
})
export const financeBookingTaxRuntimePort = optionsPort<BookingTaxRouteOptions>(
  "finance.booking-tax.runtime",
)
