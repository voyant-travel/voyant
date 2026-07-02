/**
 * Bookings agent tools on the framework tool contract. Thin, read-only wrappers
 * over the existing bookings service; the service is injected on the tool context
 * by intersection so this module stays deployment-agnostic.
 *
 * `list_bookings` / `get_booking` return non-PII booking state (`bookings:read`).
 * PII fields are a separate concern gated on `bookings-pii:read` (see the booking
 * PII surface) and are not exposed here.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import { bookingListQuerySchema } from "./validation.js"

export interface BookingsToolServices {
  listBookings(query: z.infer<typeof bookingListQuerySchema>): Promise<unknown>
  getBookingById(id: string): Promise<unknown>
}

export type BookingsToolContext = ToolContext & { bookings?: BookingsToolServices }

function bookings(ctx: BookingsToolContext): BookingsToolServices {
  return requireService(ctx.bookings, "bookings")
}

export const listBookingsTool = defineTool<
  z.infer<typeof bookingListQuerySchema>,
  unknown,
  BookingsToolContext
>({
  name: "list_bookings",
  description: "List bookings with filters and pagination. Non-PII state only. Read-only.",
  inputSchema: bookingListQuerySchema,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["bookings:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return bookings(ctx).listBookings(query)
  },
})

const getBookingArgs = z.object({ id: z.string().min(1).describe("The booking id.") })

export const getBookingTool = defineTool<
  z.infer<typeof getBookingArgs>,
  unknown,
  BookingsToolContext
>({
  name: "get_booking",
  description: "Read a single booking's non-PII state by id. Read-only.",
  inputSchema: getBookingArgs,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["bookings:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return bookings(ctx).getBookingById(id)
  },
})

export const bookingsTools = [listBookingsTool, getBookingTool] as const
