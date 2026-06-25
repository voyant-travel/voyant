/**
 * Admin booking-scoped finance read routes — mounted by the operator starter
 * under `/v1/admin/finance/...` (staff-actor-gated by the parent app's
 * middleware chain). Mirrors the customer-portal
 * `/v1/public/finance/bookings/:bookingId/payments` endpoint on the admin
 * surface so operators can see the canonical `payments` rows on the booking
 * detail page (the admin actor guard blocks staff sessions from the public path).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9E). The response reuses the existing
 * `@voyant-travel/finance-contracts` `publicBookingFinancePaymentsSchema` — the
 * same shape the public flow serializes, since the handler reuses the same
 * `publicFinanceService.getBookingPayments` helper. Single `.openapi()` leg on
 * an `OpenAPIHono` whose operation propagates up through the parent admin
 * registry (`financeRoutes`).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"

import type { Env } from "./routes-shared.js"
import { publicBookingFinancePaymentsSchema } from "./validation.js"

const errorResponseSchema = z.object({ error: z.string() })

const listBookingPaymentsRoute = createRoute({
  method: "get",
  path: "/bookings/{bookingId}/payments",
  request: { params: z.object({ bookingId: z.string() }) },
  responses: {
    200: {
      description: "The booking's canonical payment rows (admin mirror of the portal endpoint)",
      content: {
        "application/json": { schema: z.object({ data: publicBookingFinancePaymentsSchema }) },
      },
    },
    404: {
      description: "Booking payments not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const financeBookingReadRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
}).openapi(listBookingPaymentsRoute, async (c) => {
  const { publicFinanceService } = await import("./service-public.js")
  const result = await publicFinanceService.getBookingPayments(
    c.get("db"),
    c.req.valid("param").bookingId,
  )
  if (!result) {
    return c.json({ error: "Booking payments not found" }, 404)
  }
  return c.json({ data: result }, 200)
})
