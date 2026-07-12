import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import type { Extension } from "@voyant-travel/core"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"

import { FINANCE_ROUTE_RUNTIME_CONTAINER_KEY, type FinanceRouteRuntime } from "./route-runtime.js"
import type { Env } from "./routes-shared.js"
import { bookingCreateSchema, createBooking } from "./service-booking-create.js"
import { dualCreateBooking, dualCreateBookingSchema } from "./service-bookings-dual-create.js"

// --- Response schemas ------------------------------------------------------
//
// The success `data` payload is the rich `BookingCreateResult` — a composite of
// cross-package Drizzle rows (booking, travelers, payment schedules, voucher,
// invoice, payments) owned by `@voyant-travel/bookings` / `finance`. To avoid
// asserting (and drifting against) every column those packages own, the heavy
// row sub-objects are modeled as opaque objects here; the documented contract is
// the envelope + the discriminated `invoiceDocument` status. The error branches
// are modeled precisely because they are the stable, caller-facing contract.

const opaqueRow = z.record(z.string(), z.unknown())

const bookingCreateResultSchema = z.object({
  booking: opaqueRow,
  travelers: z.array(opaqueRow),
  paymentSchedules: z.array(opaqueRow),
  voucherRedemption: z.object({ voucher: opaqueRow, redemption: opaqueRow }).nullable(),
  groupMembership: z.object({ groupId: z.string(), member: opaqueRow }).nullable(),
  invoice: opaqueRow.nullable(),
  invoiceDocument: z.union([
    z.object({ status: z.literal("requested"), renditionId: z.string().nullable() }),
    z.object({ status: z.literal("generated"), renditionId: z.string() }),
    z.object({ status: z.enum(["not_requested", "not_available", "failed"]) }),
  ]),
  payments: z.array(opaqueRow),
})

const dualCreateBookingResultSchema = z.object({
  primary: bookingCreateResultSchema,
  secondary: bookingCreateResultSchema,
  group: opaqueRow,
  primaryMember: opaqueRow,
  secondaryMember: opaqueRow,
})

const notFoundSchema = z.object({ error: z.string() })

// The create/dual-create error branches share an `error` key but carry
// branch-specific structured fields (`code`, `issues`, `mismatches`, the
// duplicate-booking refs, occupancy counts, …). They are modeled with a loose
// `{ error } + catchall` schema (rather than a strict discriminated union) so
// the inline-constructed handler bodies type-check without per-branch literal
// narrowing; the per-status `description` documents the structured shapes.
const createBadRequestSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    issues: z
      .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
      .optional(),
    mismatches: z.array(z.unknown()).optional(),
    pax: z.number().int().optional(),
    occupancyMax: z.number().int().optional(),
    shortfall: z.number().int().optional(),
  })
  .catchall(z.unknown())

const createConflictSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    existingBookingId: z.string().optional(),
    existingBookingNumber: z.string().optional(),
    existingBookingStatus: z.string().optional(),
    currentGroupId: z.string().optional(),
  })
  .catchall(z.unknown())

// The dual-create failure branches wrap a per-sub create reason and add
// `which` + `reasonStatus`, so they are looser supersets of the single-create
// error shapes.
const dualBadRequestSchema = z.object({ error: z.string() }).catchall(z.unknown())
const dualConflictSchema = z.object({ error: z.string() }).catchall(z.unknown())
const dualServerErrorSchema = z.object({ error: z.string() }).catchall(z.unknown())

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
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9E). The request bodies reuse the handlers'
 * existing `bookingCreateSchema` / `dualCreateBookingSchema`; `OpenAPIHono` so
 * the `.openapi()` operations propagate up through the composed app when the
 * extension's `adminRoutes` mount at `/v1/admin/bookings`.
 */
const createBookingRoute = createRoute({
  method: "post",
  path: "/create",
  "x-voyant-api-id": "@voyant-travel/finance#bookings-create-extension.api",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: bookingCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "The created booking with its travelers, schedules, invoice, and payments",
      content: { "application/json": { schema: z.object({ data: bookingCreateResultSchema }) } },
    },
    400: {
      description:
        "invalid_request: body failed validation, payment schedules invalid, the payload " +
        "did not match the resolved draft, or the selected rooms cannot seat the party",
      content: { "application/json": { schema: createBadRequestSchema } },
    },
    404: {
      description: "Product, voucher, or booking group not found",
      content: { "application/json": { schema: notFoundSchema } },
    },
    409: {
      description:
        "Conflict: duplicate booking, voucher state conflict, or booking already in a group",
      content: { "application/json": { schema: createConflictSchema } },
    },
  },
})

const dualCreateBookingRoute = createRoute({
  method: "post",
  path: "/dual-create",
  "x-voyant-api-id": "@voyant-travel/finance#bookings-create-extension.api",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: dualCreateBookingSchema } },
    },
  },
  responses: {
    201: {
      description: "Both created bookings linked via a new booking group",
      content: {
        "application/json": { schema: z.object({ data: dualCreateBookingResultSchema }) },
      },
    },
    400: {
      description:
        "invalid_request: body failed validation, or one sub-booking failed a 400-class " +
        "precondition (the failing side is named via `which` + `reasonStatus`)",
      content: { "application/json": { schema: dualBadRequestSchema } },
    },
    404: {
      description: "A sub-booking's product, voucher, or group was not found",
      content: { "application/json": { schema: notFoundSchema } },
    },
    409: {
      description: "A sub-booking hit a duplicate / voucher / already-in-group conflict",
      content: { "application/json": { schema: dualConflictSchema } },
    },
    500: {
      description: "Group linking failed for a sub-booking",
      content: { "application/json": { schema: dualServerErrorSchema } },
    },
  },
})

const createBookingRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(createBookingRoute, async (c) => {
    const input = c.req.valid("json")
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
  .openapi(dualCreateBookingRoute, async (c) => {
    const input = c.req.valid("json")
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
  // Mounted at the staff-guarded `/v1/admin/bookings/...` surface.
  adminRoutes: createBookingRoutes,
}
