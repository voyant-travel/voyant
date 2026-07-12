import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { BookingTaxRouteOptions } from "./booking-tax.js"
import type { FinanceHonoModuleOptions } from "./index.js"
import type { FinanceBookingScheduleRuntime } from "./runtime-port.js"
import {
  financeBookingScheduleRuntimePort,
  financeBookingTaxRuntimePort,
  financeRuntimePort,
} from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface FinanceRuntimePortContribution {
  finance: RuntimePortValue<FinanceHonoModuleOptions>
  bookingSchedule: RuntimePortValue<FinanceBookingScheduleRuntime>
  bookingTax: RuntimePortValue<BookingTaxRouteOptions>
}

export interface FinanceRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Finance defaults lowered from the generic runtime host. */
export function createFinanceRuntimePortContribution(
  host: FinanceRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const noPolicy = async () => null
  const runtime: FinanceRuntimePortContribution = {
    finance: {
      resolveDocumentDownloadUrl: host.primitives.storage.downloadUrl,
      invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) =>
        bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate,
    },
    bookingSchedule: {
      options: {
        resolveDb: (context) => host.primitives.database.fromContext(context),
        resolveOperatorDefaultPaymentPolicy: noPolicy,
        resolveSupplierPolicy: noPolicy,
        resolveCategoryPolicy: noPolicy,
        resolveListingPolicy: noPolicy,
        resolveListingPolicyForEntity: noPolicy,
        resolveCategoryPolicyForEntity: noPolicy,
        resolveSupplierPolicyForEntity: noPolicy,
        stampPolicySourceOnBooking: async () => undefined,
        readPolicySourceFromInternalNotes: () => null,
      },
      withDb: (bindings, operation) =>
        host.primitives.database.transaction(bindings, (database) =>
          operation(database as Parameters<typeof operation>[0]),
        ),
    },
    bookingTax: {},
  }
  return {
    [financeRuntimePort.id]: runtime.finance,
    [financeBookingScheduleRuntimePort.id]: runtime.bookingSchedule,
    [financeBookingTaxRuntimePort.id]: runtime.bookingTax,
  }
}
