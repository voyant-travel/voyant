import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import type { Extension } from "@voyant-travel/core"
import { parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { type Context, Hono } from "hono"

import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, type FinanceRouteRuntime } from "./route-runtime.js"
import type { Env } from "./routes-shared.js"
import { bookingCreateSchema, createBooking } from "./service-booking-create.js"
import { dualCreateBooking, dualCreateBookingSchema } from "./service-bookings-dual-create.js"

function resolveRuntime(container: { resolve: <T>(key: string) => T } | undefined) {
  try {
    return container?.resolve<FinanceRouteRuntime>(FINANCE_ROUTE_RUNTIME_CONTAINER_KEY)
  } catch {
    return undefined
  }
}

function getBookingCreateActionLedgerRequestContext(
  c: Context<Env>,
): ActionLedgerRequestContextValues | undefined {
  const context = {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }

  if (
    context.userId ||
    context.agentId ||
    context.workflowPrincipalId ||
    context.apiTokenId ||
    context.isInternalRequest
  ) {
    return context
  }

  return undefined
}

/**
 * Mounted under `/v1/admin/bookings/*` via the extension's `module` target, so
 * the endpoint's public-facing path lands at `POST /v1/admin/bookings/create`
 * even though the code lives in `@voyant-travel/finance`. See the header comment in
 * service-booking-create.ts for why finance owns this orchestration.
 */
const createBookingRoutes = new Hono<Env>()
  .post("/create", async (c) => {
    const input = await parseJsonBody(c, bookingCreateSchema)
    const runtime = resolveRuntime(c.var.container)

    const outcome = await createBooking(c.get("db"), input, {
      userId: c.get("userId"),
      runtime: {
        ...(runtime ?? {}),
        actionLedgerContext: getBookingCreateActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "booking.create.route",
      },
    })

    switch (outcome.status) {
      case "ok":
        return c.json({ data: outcome.result }, 201)
      case "invalid_payment_schedules":
        return c.json(
          {
            error: "Invalid payment schedules",
            issues: outcome.issues,
          },
          400,
        )
      case "payload_resolver_mismatch":
        return c.json(
          {
            error: "Booking payload does not match the resolved draft",
            code: "payload_resolver_mismatch",
            mismatches: outcome.mismatches,
          },
          400,
        )
      case "room_occupancy_insufficient":
        return c.json(
          {
            error: "Selected rooms cannot seat the booking party",
            code: "room_occupancy_insufficient",
            pax: outcome.pax,
            occupancyMax: outcome.occupancyMax,
            shortfall: outcome.shortfall,
          },
          400,
        )
      case "duplicate_booking":
        return c.json(
          {
            error: "Duplicate booking",
            code: "duplicate_booking",
            existingBookingId: outcome.existingBooking.id,
            existingBookingNumber: outcome.existingBooking.bookingNumber,
            existingBookingStatus: outcome.existingBooking.status,
          },
          409,
        )
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
      runtime: {
        ...(runtime ?? {}),
        actionLedgerContext: getBookingCreateActionLedgerRequestContext(c),
        actionLedgerAuthorizationSource: "booking.create.route",
      },
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
      case "invalid_payment_schedules":
        return c.json(
          {
            ...body,
            error: `${which}: invalid payment schedules`,
            issues: reason.issues,
          },
          400,
        )
      case "payload_resolver_mismatch":
        return c.json(
          {
            ...body,
            error: `${which}: booking payload does not match the resolved draft`,
            code: "payload_resolver_mismatch",
            mismatches: reason.mismatches,
          },
          400,
        )
      case "room_occupancy_insufficient":
        return c.json(
          {
            ...body,
            error: `${which}: selected rooms cannot seat the booking party`,
            code: "room_occupancy_insufficient",
            pax: reason.pax,
            occupancyMax: reason.occupancyMax,
            shortfall: reason.shortfall,
          },
          400,
        )
      case "duplicate_booking":
        return c.json(
          {
            ...body,
            error: `${which}: duplicate booking`,
            code: "duplicate_booking",
            existingBookingId: reason.existingBooking.id,
            existingBookingNumber: reason.existingBooking.bookingNumber,
            existingBookingStatus: reason.existingBooking.status,
          },
          409,
        )
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
