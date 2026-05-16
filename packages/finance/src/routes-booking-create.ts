import type { Extension } from "@voyantjs/core"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoExtension } from "@voyantjs/hono/module"
import { Hono } from "hono"

import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, type FinanceRouteRuntime } from "./route-runtime.js"
import { bookingCreateSchema, createBooking } from "./service-booking-create.js"
import { dualCreateBooking, dualCreateBookingSchema } from "./service-bookings-dual-create.js"

function resolveRuntime(container: { resolve: <T>(key: string) => T }): FinanceRouteRuntime | null {
  try {
    return container.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
  } catch {
    return null
  }
}

/**
 * Mounted under `/v1/admin/bookings/*` via the extension's `module` target, so
 * the endpoint's public-facing path lands at `POST /v1/admin/bookings/create`
 * even though the code lives in `@voyantjs/finance`. See the header comment in
 * service-booking-create.ts for why finance owns this orchestration.
 */
const createBookingRoutes = new Hono<{
  Variables: {
    db: import("drizzle-orm/postgres-js").PostgresJsDatabase
    userId?: string
    container: { resolve: <T>(key: string) => T }
  }
}>()
  .post("/create", async (c) => {
    const input = await parseJsonBody(c, bookingCreateSchema)
    const runtime = resolveRuntime(c.var.container)

    const outcome = await createBooking(c.get("db"), input, {
      userId: c.get("userId"),
      runtime: runtime
        ? {
            eventBus: runtime.eventBus,
            invoiceDocumentGenerator: runtime.invoiceDocumentGenerator,
          }
        : undefined,
    })

    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.result }, 201)
      case "product_not_found":
        return c.json({ error: "Product not found or unavailable" }, 404)
      case "voucher_not_found":
        return c.json({ error: "Voucher not found" }, 404)
      case "voucher_inactive":
        return c.json({ error: "Voucher is not active" }, 409)
      case "voucher_not_started":
        return c.json({ error: "Voucher is not yet valid" }, 409)
      case "voucher_expired":
        return c.json({ error: "Voucher has expired" }, 409)
      case "voucher_insufficient_balance":
        return c.json({ error: "Voucher does not have enough balance" }, 409)
      case "group_not_found":
        return c.json({ error: "Booking group not found" }, 404)
      case "booking_already_in_group":
        return c.json(
          {
            error: "Booking is already a member of a group",
            currentGroupId: outcome.currentGroupId,
          },
          409,
        )
    }
  })
  .post("/dual-create", async (c) => {
    const input = await parseJsonBody(c, dualCreateBookingSchema)
    const runtime = resolveRuntime(c.var.container)

    const outcome = await dualCreateBooking(c.get("db"), input, {
      userId: c.get("userId"),
      runtime: runtime ? { eventBus: runtime.eventBus } : undefined,
    })

    if (outcome.status === "ok") {
      return c.json({ data: outcome.result }, 201)
    }

    // Both failure branches carry a nested create reason. Map them to
    // the same HTTP codes the single create endpoint uses so callers
    // can treat them uniformly, and surface which sub-booking tripped.
    const which = outcome.status === "primary_failed" ? "primary" : "secondary"
    const reason = outcome.reason
    const body: Record<string, unknown> = { which, reasonStatus: reason.status }
    switch (reason.status) {
      case "product_not_found":
        return c.json({ ...body, error: `${which}: product not found or unavailable` }, 404)
      case "voucher_not_found":
        return c.json({ ...body, error: `${which}: voucher not found` }, 404)
      case "voucher_inactive":
        return c.json({ ...body, error: `${which}: voucher is not active` }, 409)
      case "voucher_not_started":
        return c.json({ ...body, error: `${which}: voucher is not yet valid` }, 409)
      case "voucher_expired":
        return c.json({ ...body, error: `${which}: voucher has expired` }, 409)
      case "voucher_insufficient_balance":
        return c.json({ ...body, error: `${which}: voucher does not have enough balance` }, 409)
      case "group_not_found":
        return c.json({ ...body, error: `${which}: group linking failed` }, 500)
      case "booking_already_in_group":
        return c.json(
          {
            ...body,
            error: `${which}: booking is already in a group`,
            currentGroupId: reason.currentGroupId,
          },
          409,
        )
    }
  })

const bookingsCreateExtensionDef: Extension = {
  name: "bookings-create",
  module: "bookings",
}

export const bookingsCreateExtension: HonoExtension = {
  extension: bookingsCreateExtensionDef,
  // Mount on both surfaces to mirror bookings' own module routes. The legacy
  // `/v1/bookings/...` path is what existing bookings-react hooks hit; the
  // `/v1/admin/bookings/...` path is staff-guarded and the forward-looking
  // convention. Both serve the same handler.
  adminRoutes: createBookingRoutes,
  routes: createBookingRoutes,
}
