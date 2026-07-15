import { isStaffRbacEnforced } from "@voyant-travel/hono"
import { defineToolContextContribution } from "@voyant-travel/tools"
import type { Context } from "hono"
import { contributeBookingsExtrasToolContext } from "./extras/mcp-runtime.js"
import { redactBookingContact, shouldRevealBookingPii } from "./pii-redaction.js"
import { contributeBookingRequirementsToolContext } from "./requirements/mcp-runtime.js"
import { bookingsService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["bookings", "bookingsExtras", "bookingRequirements"],
  contribute: (input) => {
    const { request, context } = input
    const c = request as Context
    const db = context.db as Parameters<typeof bookingsService.listBookings>[0]
    const reveal = shouldRevealBookingPii({
      actor: c.var.actor,
      scopes: c.var.scopes,
      callerType: c.var.callerType,
      isInternalRequest: c.var.isInternalRequest,
      enforceRbac: isStaffRbacEnforced(c.env),
    })
    return Object.assign(
      {
        bookings: {
          async listBookings(query: Parameters<typeof bookingsService.listBookings>[1]) {
            const result = await bookingsService.listBookings(db, query)
            if (reveal || !isRecord(result) || !Array.isArray(result.data)) return result
            return { ...result, data: result.data.map(redactBookingRow) }
          },
          async getBookingById(id: string) {
            const row = await bookingsService.getBookingById(db, id)
            return reveal ? row : redactBookingRow(row)
          },
        },
      },
      contributeBookingsExtrasToolContext(input),
      contributeBookingRequirementsToolContext(input),
    )
  },
})

function redactBookingRow<T>(row: T): T {
  return isRecord(row)
    ? (redactBookingContact(row as Parameters<typeof redactBookingContact>[0]) as T)
    : row
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
