// agent-quality: file-size exception -- owner: bookings; existing route module stays co-located until a dedicated split preserves behavior and tests.

import {
  ACTION_LEDGER_APPROVAL_ID_HEADER,
  ActionApprovalDecisionConflictError,
  type ActionApprovalResponse,
  type ActionLedgerCapabilityAccessResult,
  type ActionLedgerEntry,
  type ActionLedgerEntryResponse,
  ActionLedgerIdempotencyConflictError,
  type ActionLedgerRequestContextValues,
  actionLedgerService,
  appendActionLedgerMutation,
  appendActionLedgerSensitiveRead,
  type BuildActionLedgerApprovedExecutionFieldsInput,
  buildActionApprovalCommandFingerprint,
  buildActionLedgerApprovedExecutionFields,
  decideActionLedgerApproval,
  evaluateActionLedgerApprovalRequirement,
  evaluateActionLedgerCapabilityAccess,
  ledgerSensitiveRead,
  mapActionLedgerRequestContext,
  requestActionLedgerApproval,
} from "@voyant-travel/action-ledger"
import { validateCustomFields } from "@voyant-travel/core/custom-fields"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  aggregateSnapshotKey,
  readThroughAggregateSnapshot,
} from "@voyant-travel/db/aggregate-snapshots"
import {
  ForbiddenApiError,
  handleApiError,
  idempotencyKey,
  isStaffRbacEnforced,
  normalizeValidationError,
  parseJsonBody,
  parseQuery,
  RequestValidationError,
  requireUserId,
  UnauthorizedApiError,
} from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"
import { z } from "zod"

import {
  BOOKING_PII_READ_CAPABILITY,
  BOOKING_STATUS_CAPABILITIES,
} from "./action-ledger-capabilities.js"
import { createBookingPiiService } from "./pii.js"
import {
  redactBookingContact,
  redactTravelerIdentity,
  shouldRevealBookingPii,
} from "./pii-redaction.js"
import {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  type BookingRouteRuntime,
  buildBookingRouteRuntime,
} from "./route-runtime.js"
import { bookingGroupRoutes } from "./routes-groups.js"
import type { publicBookingRoutes } from "./routes-public.js"
import type { Env } from "./routes-shared.js"
import { bookingPiiAccessLog } from "./schema.js"
import { bookingsService } from "./service.js"
import { bookingGroupsService } from "./service-groups.js"
import { publicBookingsService, resolveSessionPricingSnapshot } from "./service-public.js"
import {
  bookingAggregatesQuerySchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  completeBookingSchema,
  confirmBookingSchema,
  convertProductSchema,
  createBookingSchema,
  createTravelerWithTravelDetailsSchema,
  expireBookingSchema,
  expireStaleBookingsSchema,
  extendBookingHoldSchema,
  insertBookingDocumentSchema,
  insertBookingFulfillmentSchema,
  insertBookingItemSchema,
  insertBookingItemTravelerSchema,
  insertBookingNoteSchema,
  insertSupplierStatusSchema,
  insertTravelerSchema,
  internalBookingOverviewLookupQuerySchema,
  overrideBookingStatusSchema,
  pricingPreviewSchema,
  recordBookingRedemptionSchema,
  reserveBookingSchema,
  sharingGroupsForSlotQuerySchema,
  startBookingSchema,
  updateBookingFulfillmentSchema,
  updateBookingItemSchema,
  updateBookingNoteSchema,
  updateBookingSchema,
  updateSupplierStatusSchema,
  updateTravelerSchema,
  updateTravelerWithTravelDetailsSchema,
  upsertTravelerTravelDetailsSchema,
} from "./validation.js"

function hasPiiScope(scopes: string[] | null | undefined, action: "read" | "update" | "delete") {
  if (!scopes || scopes.length === 0) {
    return false
  }

  return (
    scopes.includes("*") ||
    scopes.includes("bookings-pii:*") ||
    scopes.includes(`bookings-pii:${action}`)
  )
}

const BOOKING_PII_READ_ACTION_NAME = "booking.pii.read"
const BOOKING_PII_READ_ACTION_VERSION = "v1"
const BOOKING_PII_DECISION_POLICY = "bookings-pii-scope-or-staff-v1"
const BOOKING_PII_AUTHORIZATION_SOURCE = "bookings.pii.route"
const BOOKING_STATUS_APPROVAL_POLICY = "bookings-status-approval-v1"
const BOOKING_TRAVELER_LEDGER_ACTION_VERSION = "v1"
const BOOKING_ITEM_LEDGER_ACTION_VERSION = "v1"
const BOOKING_NOTE_LEDGER_ACTION_VERSION = "v1"

type ApprovedBookingStatusAction = BuildActionLedgerApprovedExecutionFieldsInput
type BookingMutationLedgerInput = {
  action: BookingMutationAction
  actionName: string
  actionVersion: string
  targetType: string
  targetId: string
  changedFields: string[]
  subject: string
  routeOrToolName: string
  authorizationSource?: string
  evaluatedRisk?: ActionLedgerEntry["evaluatedRisk"]
  summary?: string
}
type BookingTravelerMutationLedgerInput = {
  action: BookingTravelerLedgerAction
  travelerId: string
  changedFields: string[]
  subject: string
  actionName: string
  routeOrToolName: string
  evaluatedRisk?: ActionLedgerEntry["evaluatedRisk"]
  summary?: string
}
type BookingStatusApprovalTargetState =
  | {
      exists: false
    }
  | {
      exists: true
      status: string
      sellCurrency: string
      sellAmountCents: number | null
      costAmountCents: number | null
      customerPaymentPolicy: unknown
      holdExpiresAt: string | null
      confirmedAt: string | null
      awaitingPaymentAt: string | null
      paidAt: string | null
      cancelledAt: string | null
      completedAt: string | null
      expiredAt: string | null
    }
type TravelerTravelDetails = Awaited<
  ReturnType<ReturnType<typeof createBookingPiiService>["getTravelerTravelDetails"]>
>

const TRAVELER_IDENTITY_DISCLOSED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "specialRequests",
  "notes",
]
const TRAVELER_TRAVEL_DETAIL_DISCLOSED_FIELDS = [
  "nationality",
  "documentType",
  "documentNumber",
  "documentExpiry",
  "documentIssuingCountry",
  "documentIssuingAuthority",
  "documentPersonDocumentId",
  "dateOfBirth",
  "dietaryRequirements",
  "accessibilityNeeds",
  "isLeadTraveler",
  "sharingGroupId",
  "roomTypeId",
  "bedPreference",
  "allocations",
]
const TRAVELER_MUTATION_FIELDS = [
  "personId",
  "participantType",
  "travelerCategory",
  "firstName",
  "lastName",
  "email",
  "phone",
  "preferredLanguage",
  "specialRequests",
  "isPrimary",
  "notes",
]
const BOOKING_ITEM_MUTATION_FIELDS = [
  "title",
  "description",
  "itemType",
  "status",
  "serviceDate",
  "startsAt",
  "endsAt",
  "quantity",
  "sellCurrency",
  "unitSellAmountCents",
  "totalSellAmountCents",
  "costCurrency",
  "unitCostAmountCents",
  "totalCostAmountCents",
  "notes",
  "productId",
  "optionId",
  "optionUnitId",
  "pricingCategoryId",
  "availabilitySlotId",
  "productNameSnapshot",
  "optionNameSnapshot",
  "unitNameSnapshot",
  "departureLabelSnapshot",
  "sourceSnapshotId",
  "sourceOfferId",
  "metadata",
]

const bookingActionLedgerQuerySchema = z
  .object({
    cursorOccurredAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(199).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorOccurredAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorOccurredAt ? ["cursorId"] : ["cursorOccurredAt"],
      message: "cursorOccurredAt and cursorId must be provided together",
    })
  })
  .transform(({ cursorOccurredAt, cursorId, ...query }) => ({
    ...query,
    cursor:
      cursorOccurredAt && cursorId
        ? {
            occurredAt: cursorOccurredAt,
            id: cursorId,
          }
        : undefined,
  }))

const decideBookingActionApprovalBodySchema = z.object({
  status: z.enum(["approved", "denied"]),
})

interface BookingActionLedgerTravelerTarget {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface BookingActionLedgerListResponse {
  data: ActionLedgerEntryResponse[]
  travelers: BookingActionLedgerTravelerTarget[]
  pageInfo: {
    nextCursor: {
      occurredAt: string
      id: string
    } | null
  }
}

export interface BookingActionApprovalDecisionResponse {
  data: {
    approval: ActionApprovalResponse
    decisionAction: ActionLedgerEntryResponse
  }
}

const DASHBOARD_AGGREGATES_CACHE_CONTROL = "private, max-age=30"

/** Server-side snapshot TTL — see readThroughAggregateSnapshot (#1629). */
const DASHBOARD_AGGREGATES_TTL_SECONDS = 60

function cacheDashboardAggregates(c: Context<Env>) {
  c.header("Cache-Control", DASHBOARD_AGGREGATES_CACHE_CONTROL)
  c.header("Vary", "Authorization", { append: true })
  c.header("Vary", "Cookie", { append: true })
}

function getActionLedgerRequestContext(c: Context<Env>): ActionLedgerRequestContextValues {
  return {
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
}

async function validateBookingBillingPartyReferences<T extends Env>(
  c: Context<T>,
  data: { personId?: string | null; organizationId?: string | null },
) {
  const runtime = getRouteRuntime(c)
  const db = c.get("db")

  if (data.personId && runtime.resolveBillingPersonById) {
    const exists = await runtime.resolveBillingPersonById(db, data.personId)
    if (!exists) {
      throw new RequestValidationError("Booking personId does not reference an existing person", {
        fields: {
          fieldErrors: { personId: ["Person not found"] },
          formErrors: [],
        },
      })
    }
  }

  if (data.organizationId && runtime.resolveBillingOrganizationById) {
    const exists = await runtime.resolveBillingOrganizationById(db, data.organizationId)
    if (!exists) {
      throw new RequestValidationError(
        "Booking organizationId does not reference an existing organization",
        {
          fields: {
            fieldErrors: { organizationId: ["Organization not found"] },
            formErrors: [],
          },
        },
      )
    }
  }
}

/**
 * Validate a booking write's `customFields` against the deployment's injected
 * custom-field registry (see `@voyant-travel/core/custom-fields`) and replace
 * the payload value with the cleaned, registry-approved object. No-op when the
 * write carries no `customFields`. Rejects (400) unknown keys / missing required
 * / bad types, or any `customFields` at all when the deployment declares none.
 */
async function validateBookingCustomFields<T extends Env>(
  c: Context<T>,
  data: { customFields?: Record<string, unknown> },
  mode: "create" | "update",
): Promise<void> {
  const resolveRegistry = getRouteRuntime(c).customFields
  if (data.customFields === undefined) {
    // A partial update without custom fields, or no registry at all, is a no-op.
    // A create with an absent envelope still validates `{}` so `required` fields
    // are enforced.
    if (mode === "update" || !resolveRegistry) {
      return
    }
  } else if (!resolveRegistry) {
    throw new RequestValidationError("Custom fields are not configured for this deployment", {
      fields: { fieldErrors: { customFields: ["not configured"] }, formErrors: [] },
    })
  }
  if (!resolveRegistry) {
    return
  }
  const registry = await resolveRegistry(c.get("db"))
  const result = validateCustomFields(registry, "booking", data.customFields ?? {})
  if (!result.ok) {
    throw new RequestValidationError("Invalid booking custom fields", {
      fields: {
        fieldErrors: Object.fromEntries(result.errors.map((e) => [e.key, [e.message]])),
        formErrors: [],
      },
    })
  }
  data.customFields = result.value
}

type BookingTravelerLedgerAction = "create" | "update" | "delete"
type BookingMutationAction = "create" | "update" | "delete"

function changedBookingMutationFields(
  input: Record<string, unknown>,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  const fields = Object.keys(input).filter((field) => !ignoredBookingMutationFields.has(field))
  if (!before || !after) return fields.sort()

  return fields.filter((field) => !bookingValuesEqual(before[field], after[field])).sort()
}

function changedBookingTravelerFields(
  input: Record<string, unknown>,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  const travelerFields = new Set(TRAVELER_MUTATION_FIELDS)
  return changedBookingMutationFields(input, before, after).filter((field) =>
    travelerFields.has(field),
  )
}

function changedBookingTravelDetailFields(input: Record<string, unknown>): string[] {
  const travelDetailFields = new Set(TRAVELER_TRAVEL_DETAIL_DISCLOSED_FIELDS)
  return Object.keys(input)
    .filter((field) => travelDetailFields.has(field))
    .sort()
}

function changedBookingItemFields(
  input: Record<string, unknown>,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  const itemFields = new Set(BOOKING_ITEM_MUTATION_FIELDS)
  return changedBookingMutationFields(input, before, after).filter((field) => itemFields.has(field))
}

function bookingMutationSummary(action: BookingMutationAction, fields: string[], subject: string) {
  if (action === "delete") return `Deleted ${subject}`
  if (fields.length === 0) return action === "create" ? `Created ${subject}` : `Updated ${subject}`
  const verb = action === "create" ? "Created" : "Updated"
  return `${verb} ${subject} fields: ${fields.join(", ")}`
}

async function appendBookingMutationLedgerEntry(
  c: Context<Env>,
  input: BookingMutationLedgerInput,
) {
  return appendBookingMutationLedgerEntryToDb(c.get("db"), getActionLedgerRequestContext(c), input)
}

async function appendBookingMutationLedgerEntryToDb(
  db: AnyDrizzleDb,
  context: ActionLedgerRequestContextValues,
  input: BookingMutationLedgerInput,
) {
  return appendActionLedgerMutation(db, {
    context,
    actionName: input.actionName,
    actionVersion: input.actionVersion,
    actionKind: input.action,
    evaluatedRisk: input.evaluatedRisk ?? "medium",
    targetType: input.targetType,
    targetId: input.targetId,
    routeOrToolName: input.routeOrToolName,
    authorizationSource: input.authorizationSource ?? "bookings.route",
    mutationDetail: {
      summary:
        input.summary ?? bookingMutationSummary(input.action, input.changedFields, input.subject),
      reversalKind: "none",
    },
  })
}

async function appendBookingTravelerMutationLedgerEntryToDb(
  db: AnyDrizzleDb,
  context: ActionLedgerRequestContextValues,
  input: BookingTravelerMutationLedgerInput,
) {
  return appendBookingMutationLedgerEntryToDb(db, context, {
    ...input,
    actionName: input.actionName,
    actionVersion: BOOKING_TRAVELER_LEDGER_ACTION_VERSION,
    targetType: "booking_traveler",
    targetId: input.travelerId,
    authorizationSource: BOOKING_PII_AUTHORIZATION_SOURCE,
    evaluatedRisk: input.evaluatedRisk ?? "high",
  })
}

function bookingValuesEqual(left: unknown, right: unknown) {
  if (left instanceof Date || right instanceof Date) {
    const leftTime = left instanceof Date ? left.getTime() : new Date(String(left)).getTime()
    const rightTime = right instanceof Date ? right.getTime() : new Date(String(right)).getTime()
    return leftTime === rightTime
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

const ignoredBookingMutationFields = new Set(["updatedAt", "createdAt"])

type BookingStatusCapabilityRoute =
  | {
      key: "confirm"
      actionName: "booking.status.confirm"
      routeOrToolName: "bookings.confirm"
    }
  | {
      key: "expire"
      actionName: "booking.status.expire"
      routeOrToolName: "bookings.expire"
    }
  | {
      key: "cancel"
      actionName: "booking.status.cancel"
      routeOrToolName: "bookings.cancel"
    }
  | {
      key: "start"
      actionName: "booking.status.start"
      routeOrToolName: "bookings.start"
    }
  | {
      key: "complete"
      actionName: "booking.status.complete"
      routeOrToolName: "bookings.complete"
    }
  | {
      key: "override"
      actionName: "booking.status.override"
      routeOrToolName: "bookings.override-status"
    }

async function authorizeBookingStatusMutation(
  c: Context<Env>,
  input: BookingStatusCapabilityRoute & {
    bookingId: string
    commandInput?: unknown
  },
) {
  const capability = BOOKING_STATUS_CAPABILITIES[input.key]
  const access = evaluateActionLedgerCapabilityAccess({
    definition: capability,
    actor: c.get("actor"),
    callerType: c.get("callerType"),
    scopes: c.get("scopes"),
    isInternalRequest: c.get("isInternalRequest"),
  })

  if (access.allowed) {
    const approvalRequirement = evaluateActionLedgerApprovalRequirement({
      access,
      conditionalApprovalRequired: requiresBookingStatusApproval(c, input.key),
      reasonCode: bookingStatusApprovalReason(c, input.key),
    })

    if (approvalRequirement.required) {
      const approvedAction = await resolveApprovedBookingStatusAction(
        c,
        input,
        access,
        approvalRequirement,
      )
      if (approvedAction) {
        if (!approvedAction.allowed) return approvedAction
        return { allowed: true as const, access, approvedAction: approvedAction.action }
      }

      const idempotencyKey = c.req.header("idempotency-key") ?? null
      if (!idempotencyKey) {
        return {
          allowed: false as const,
          response: c.json(
            {
              error: "Approval-required booking status actions require an Idempotency-Key",
            },
            400,
          ),
        }
      }

      const idempotencyScope = `${input.routeOrToolName}:${input.bookingId}`
      const idempotencyFingerprint = await buildBookingStatusApprovalFingerprint(
        input,
        await loadBookingStatusApprovalTargetState(c, input.bookingId),
        access,
        approvalRequirement,
      )

      const requestInput = {
        context: getActionLedgerRequestContext(c),
        actionName: input.actionName,
        actionVersion: capability.version,
        actionKind: "update",
        evaluatedRisk: approvalRequirement.evaluatedRisk,
        targetType: "booking",
        targetId: input.bookingId,
        routeOrToolName: input.routeOrToolName,
        capabilityId: access.capabilityId,
        capabilityVersion: access.capabilityVersion,
        authorizationSource: access.authorizationSource,
        idempotencyScope,
        idempotencyKey,
        idempotencyFingerprint,
        mutationDetail: {
          summary: `Booking status ${capability.action} awaiting approval: ${approvalRequirement.reasonCode}`,
          reversalKind: "none",
        },
        approval: {
          policyName: BOOKING_STATUS_APPROVAL_POLICY,
          policyVersion: capability.version,
          riskSnapshot: approvalRequirement.evaluatedRisk,
          reasonCode: approvalRequirement.reasonCode,
        },
      } as const

      let result: Awaited<ReturnType<typeof requestActionLedgerApproval>>
      try {
        result = await requestActionLedgerApproval(c.get("db"), requestInput)
      } catch (error) {
        if (error instanceof ActionLedgerIdempotencyConflictError) {
          return {
            allowed: false as const,
            response: c.json(
              {
                error: error.message,
                existingActionId: error.existingActionId,
              },
              409,
            ),
          }
        }
        throw error
      }

      return {
        allowed: false as const,
        response: c.json(
          {
            data: {
              approvalRequired: true,
              requestedAction: {
                id: result.requestedAction.id,
                status: result.requestedAction.status,
                actionName: result.requestedAction.actionName,
                targetType: result.requestedAction.targetType,
                targetId: result.requestedAction.targetId,
              },
              approval: {
                id: result.approval.id,
                status: result.approval.status,
                requestedActionId: result.approval.requestedActionId,
                requestedByPrincipalId: result.approval.requestedByPrincipalId,
                assignedToPrincipalId: result.approval.assignedToPrincipalId,
                policyName: result.approval.policyName,
                policyVersion: result.approval.policyVersion,
                riskSnapshot: result.approval.riskSnapshot,
                reasonCode: result.approval.reasonCode,
                expiresAt: result.approval.expiresAt,
                createdAt: result.approval.createdAt,
              },
              replayed: result.replayed,
            },
          },
          202,
        ),
      }
    }

    return { allowed: true as const, access }
  }

  await appendActionLedgerMutation(c.get("db"), {
    context: getActionLedgerRequestContext(c),
    actionName: input.actionName,
    actionVersion: capability.version,
    actionKind: "update",
    status: "denied",
    evaluatedRisk: access.evaluatedRisk,
    targetType: "booking",
    targetId: input.bookingId,
    routeOrToolName: input.routeOrToolName,
    capabilityId: access.capabilityId,
    capabilityVersion: access.capabilityVersion,
    authorizationSource: access.authorizationSource,
    mutationDetail: {
      summary: `Booking status ${capability.action} denied: ${access.reason}`,
      reversalKind: "none",
    },
  })

  return {
    allowed: false as const,
    response: handleApiError(new ForbiddenApiError(), c),
  }
}

async function resolveApprovedBookingStatusAction(
  c: Context<Env>,
  input: BookingStatusCapabilityRoute & {
    bookingId: string
    commandInput?: unknown
  },
  access: ActionLedgerCapabilityAccessResult,
  approvalRequirement: ReturnType<typeof evaluateActionLedgerApprovalRequirement>,
): Promise<
  | {
      allowed: true
      action: ApprovedBookingStatusAction
    }
  | {
      allowed: false
      response: Response
    }
  | null
> {
  const approvalId = c.req.header(ACTION_LEDGER_APPROVAL_ID_HEADER)
  if (!approvalId) return null

  const executionFingerprint = await buildBookingStatusApprovalFingerprint(
    input,
    await loadBookingStatusApprovalTargetState(c, input.bookingId),
    access,
    approvalRequirement,
  )

  const actorFields = mapActionLedgerRequestContext(getActionLedgerRequestContext(c))
  const validation = await actionLedgerService.validateApprovedAction(c.get("db"), {
    approvalId,
    actionName: input.actionName,
    actionVersion: BOOKING_STATUS_CAPABILITIES[input.key].version,
    requestedActionKind: "update",
    requestedActionStatus: "awaiting_approval",
    targetType: "booking",
    targetId: input.bookingId,
    routeOrToolName: input.routeOrToolName,
    principalType: actorFields.principalType,
    principalId: actorFields.principalId,
    idempotencyFingerprint: executionFingerprint,
    executionActionKind: "update",
    executionStatus: "succeeded",
  })
  if (!validation.ok) {
    return {
      allowed: false,
      response: actionApprovalValidationResponse(c, validation),
    }
  }

  return {
    allowed: true,
    action: {
      requestedActionId: validation.requestedAction.id,
      approvalId: validation.approval.id,
      idempotencyFingerprint: validation.idempotencyFingerprint,
    },
  }
}

function buildBookingStatusApprovalFingerprint(
  input: BookingStatusCapabilityRoute & {
    bookingId: string
    commandInput?: unknown
  },
  targetState: BookingStatusApprovalTargetState,
  access: ActionLedgerCapabilityAccessResult,
  approvalRequirement: ReturnType<typeof evaluateActionLedgerApprovalRequirement>,
) {
  return buildActionApprovalCommandFingerprint({
    actionName: input.actionName,
    actionVersion: BOOKING_STATUS_CAPABILITIES[input.key].version,
    targetType: "booking",
    targetId: input.bookingId,
    commandInput: {
      command: input.commandInput ?? null,
      targetState,
    },
    approvalPolicy: approvalRequirement.approvalPolicy,
    capabilityId: access.capabilityId,
    capabilityVersion: access.capabilityVersion,
    evaluatedRisk: approvalRequirement.evaluatedRisk,
    reasonCode: approvalRequirement.reasonCode,
  })
}

async function loadBookingStatusApprovalTargetState(
  c: Context<Env>,
  bookingId: string,
): Promise<BookingStatusApprovalTargetState> {
  const booking = await bookingsService.getBookingById(c.get("db"), bookingId)
  if (!booking) return { exists: false }

  return {
    exists: true,
    status: booking.status,
    sellCurrency: booking.sellCurrency,
    sellAmountCents: booking.sellAmountCents,
    costAmountCents: booking.costAmountCents,
    customerPaymentPolicy: booking.customerPaymentPolicy,
    holdExpiresAt: serializeBookingApprovalDate(booking.holdExpiresAt),
    confirmedAt: serializeBookingApprovalDate(booking.confirmedAt),
    awaitingPaymentAt: serializeBookingApprovalDate(booking.awaitingPaymentAt),
    paidAt: serializeBookingApprovalDate(booking.paidAt),
    cancelledAt: serializeBookingApprovalDate(booking.cancelledAt),
    completedAt: serializeBookingApprovalDate(booking.completedAt),
    expiredAt: serializeBookingApprovalDate(booking.expiredAt),
  }
}

function serializeBookingApprovalDate(value: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function actionApprovalValidationResponse(
  c: Context<Env>,
  validation: Exclude<
    Awaited<ReturnType<typeof actionLedgerService.validateApprovedAction>>,
    { ok: true }
  >,
) {
  switch (validation.reason) {
    case "not_found":
      return c.json({ error: "Action approval not found" }, 404)
    case "not_approved":
      return c.json(
        {
          error: "Action approval is not approved",
          approvalId: validation.approval?.id,
          status: validation.status,
        },
        409,
      )
    case "expired":
      return c.json(
        {
          error: "Action approval has expired",
          approvalId: validation.approval?.id,
        },
        409,
      )
    case "mismatched_action":
      return c.json(
        {
          error: "Action approval does not match this booking status action",
          approvalId: validation.approval?.id,
        },
        409,
      )
    case "already_executed":
      return c.json(
        {
          error: "Action approval has already been executed",
          approvalId: validation.approval?.id,
          existingActionId: validation.existingActionId,
        },
        409,
      )
    case "missing_fingerprint":
      return c.json(
        {
          error: "Action approval is missing an approved command fingerprint",
          approvalId: validation.approval?.id,
        },
        409,
      )
    case "fingerprint_mismatch":
      return c.json(
        {
          error: "Action approval command input does not match the approved request",
          approvalId: validation.approval?.id,
        },
        409,
      )
    case "principal_mismatch":
      return c.json({ error: "Action approval belongs to a different principal" }, 403)
  }

  const exhaustiveReason: never = validation.reason
  return c.json({ error: `Unhandled action approval validation failure: ${exhaustiveReason}` }, 500)
}

function bookingStatusMutationRuntime(
  c: Context<Env>,
  auth: {
    access: ActionLedgerCapabilityAccessResult
    approvedAction?: ApprovedBookingStatusAction
  },
) {
  const approvedExecution = auth.approvedAction
    ? buildActionLedgerApprovedExecutionFields(auth.approvedAction)
    : null

  return {
    eventBus: c.get("eventBus"),
    closePaymentSchedulesForBooking: getRouteRuntime(c).closePaymentSchedulesForBooking,
    actionLedgerContext: getActionLedgerRequestContext(c),
    actionLedgerAuthorizationSource: auth.access.authorizationSource,
    actionLedgerCausationActionId: approvedExecution?.causationActionId ?? null,
    actionLedgerApprovalId: approvedExecution?.approvalId ?? null,
    actionLedgerIdempotencyScope: approvedExecution?.idempotencyScope ?? null,
    actionLedgerIdempotencyKey: approvedExecution?.idempotencyKey ?? null,
    actionLedgerIdempotencyFingerprint: approvedExecution?.idempotencyFingerprint ?? null,
  }
}

function requiresBookingStatusApproval(c: Context<Env>, key: BookingStatusCapabilityRoute["key"]) {
  const capability = BOOKING_STATUS_CAPABILITIES[key]
  if (capability.approvalPolicy !== "conditional") return false
  return (
    c.get("callerType") === "agent" ||
    c.get("callerType") === "workflow" ||
    Boolean(c.get("agentId")) ||
    Boolean(c.get("workflowPrincipalId"))
  )
}

function bookingStatusApprovalReason(c: Context<Env>, key: BookingStatusCapabilityRoute["key"]) {
  if (c.get("callerType") === "agent" || c.get("agentId")) {
    return `${key}_requested_by_agent`
  }
  if (c.get("callerType") === "workflow" || c.get("workflowPrincipalId")) {
    return `${key}_requested_by_workflow`
  }
  return null
}

async function logBookingPiiReadActionLedger(
  c: Context<Env>,
  input: {
    travelerId: string
    status: "succeeded" | "denied" | "failed"
    reason: string
    routeOrToolName: string
    disclosedFieldSet?: string[] | null
    disclosureSummary?: string | null
    decisionPolicy?: string | null
    authorizationSource?: string | null
    evaluatedRisk?: ActionLedgerCapabilityAccessResult["evaluatedRisk"] | null
  },
) {
  await appendActionLedgerSensitiveRead(c.get("db"), {
    context: getActionLedgerRequestContext(c),
    actionName: BOOKING_PII_READ_ACTION_NAME,
    actionVersion: BOOKING_PII_READ_ACTION_VERSION,
    status: input.status,
    evaluatedRisk: input.evaluatedRisk ?? "high",
    targetType: "booking_traveler",
    targetId: input.travelerId,
    routeOrToolName: input.routeOrToolName,
    capabilityId: BOOKING_PII_READ_CAPABILITY.id,
    capabilityVersion: BOOKING_PII_READ_CAPABILITY.version,
    authorizationSource: input.authorizationSource ?? BOOKING_PII_AUTHORIZATION_SOURCE,
    reasonCode: input.reason,
    disclosedFieldSet: input.status === "succeeded" ? (input.disclosedFieldSet ?? []) : [],
    disclosureSummary: input.disclosureSummary ?? null,
    decisionPolicy: input.decisionPolicy ?? BOOKING_PII_DECISION_POLICY,
  })
}

async function logBookingPiiAccess(
  c: Context<Env>,
  input: {
    bookingId?: string
    travelerId?: string
    action: "read" | "update" | "delete"
    outcome: "allowed" | "denied"
    reason?: string
    metadata?: Record<string, unknown>
  },
) {
  await c
    .get("db")
    .insert(bookingPiiAccessLog)
    .values({
      bookingId: input.bookingId ?? null,
      travelerId: input.travelerId ?? null,
      actorId: c.get("userId") ?? null,
      actorType: c.get("actor") ?? null,
      callerType: c.get("callerType") ?? null,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    })
}

async function authorizeBookingPiiAccess(
  c: Context<Env>,
  input: {
    bookingId: string
    travelerId: string
    action: "read" | "update" | "delete"
  },
) {
  if (c.get("isInternalRequest")) {
    return { allowed: true as const, access: undefined }
  }

  const userId = c.get("userId")
  if (!userId) {
    await logBookingPiiAccess(c, {
      ...input,
      outcome: "denied",
      reason: "missing_user",
    })
    if (input.action === "read") {
      await logBookingPiiReadActionLedger(c, {
        travelerId: input.travelerId,
        status: "denied",
        reason: "missing_user",
        routeOrToolName: "bookings.pii.authorize",
        disclosureSummary: "Booking PII read denied before reveal",
      })
    }
    return {
      allowed: false as const,
      response: handleApiError(new UnauthorizedApiError(), c),
    }
  }

  const customAuthorizer = c.get("authorizeBookingPii")
  if (customAuthorizer) {
    const allowed = await customAuthorizer({
      db: c.get("db"),
      userId,
      actor: c.get("actor"),
      callerType: c.get("callerType"),
      scopes: c.get("scopes"),
      isInternalRequest: c.get("isInternalRequest"),
      ...input,
    })

    if (!allowed) {
      await logBookingPiiAccess(c, {
        ...input,
        outcome: "denied",
        reason: "custom_policy_denied",
      })
      if (input.action === "read") {
        await logBookingPiiReadActionLedger(c, {
          travelerId: input.travelerId,
          status: "denied",
          reason: "custom_policy_denied",
          routeOrToolName: "bookings.pii.authorize",
          disclosureSummary: "Booking PII read denied before reveal",
          decisionPolicy: "custom",
        })
      }
      return {
        allowed: false as const,
        response: handleApiError(new ForbiddenApiError(), c),
      }
    }

    return { allowed: true as const, access: undefined }
  }

  const actor = c.get("actor")
  const scopes = c.get("scopes")

  if (input.action === "read") {
    const access = evaluateActionLedgerCapabilityAccess({
      definition: BOOKING_PII_READ_CAPABILITY,
      actor,
      callerType: c.get("callerType"),
      scopes,
      isInternalRequest: c.get("isInternalRequest"),
    })

    if (!access.allowed) {
      await logBookingPiiAccess(c, {
        ...input,
        outcome: "denied",
        reason: access.reason,
        metadata: {
          actor: actor ?? null,
          authorizationSource: access.authorizationSource,
          capabilityId: access.capabilityId,
          capabilityVersion: access.capabilityVersion,
        },
      })
      await logBookingPiiReadActionLedger(c, {
        travelerId: input.travelerId,
        status: "denied",
        reason: access.reason,
        routeOrToolName: "bookings.pii.authorize",
        disclosureSummary: "Booking PII read denied before reveal",
        authorizationSource: access.authorizationSource,
        evaluatedRisk: access.evaluatedRisk,
      })
      return {
        allowed: false as const,
        response: handleApiError(new ForbiddenApiError(), c),
      }
    }

    return { allowed: true as const, access }
  }

  const allowed = hasPiiScope(scopes, input.action) || actor === "staff"

  if (!allowed) {
    await logBookingPiiAccess(c, {
      ...input,
      outcome: "denied",
      reason: "insufficient_scope",
      metadata: { actor: actor ?? null },
    })
    return {
      allowed: false as const,
      response: handleApiError(new ForbiddenApiError(), c),
    }
  }

  return { allowed: true as const, access: undefined }
}

function handleKmsConfigError(c: Context<Env>, error: unknown) {
  if (error instanceof Error) {
    return c.json(
      {
        error: "Booking PII encryption is not configured",
        details: error.message,
      },
      500,
    )
  }

  return c.json({ error: "Booking PII encryption is not configured" }, 500)
}

function getRouteRuntime<T extends Env>(c: Context<T>): BookingRouteRuntime {
  try {
    const runtime = c.var.container?.resolve(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY) as
      | BookingRouteRuntime
      | undefined

    return runtime ?? buildBookingRouteRuntime(c.env)
  } catch {
    return buildBookingRouteRuntime(c.env)
  }
}

async function createAuditedBookingPiiService(c: Context<Env>, bookingId: string) {
  const runtime = getRouteRuntime(c)
  const kms = await runtime.getKmsProvider()

  return createBookingPiiService({
    kms,
    onAudit: async (event) => {
      await logBookingPiiAccess(c, {
        bookingId,
        travelerId: event.travelerId,
        action:
          event.action === "encrypt"
            ? "update"
            : event.action === "decrypt"
              ? "read"
              : event.action,
        outcome: "allowed",
      })
    },
  })
}

function serializeBookingActionLedgerDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Booking action ledger timestamp must be a valid date")
  }
  return date.toISOString()
}

function serializeBookingActionLedgerEntry(entry: ActionLedgerEntry): ActionLedgerEntryResponse {
  return {
    ...entry,
    occurredAt: serializeBookingActionLedgerDate(entry.occurredAt),
    createdAt: serializeBookingActionLedgerDate(entry.createdAt),
  }
}

function toBookingActionLedgerCursor(entry: Pick<ActionLedgerEntry, "occurredAt" | "id">) {
  return {
    occurredAt: serializeBookingActionLedgerDate(entry.occurredAt),
    id: entry.id,
  }
}

function sortBookingActionLedgerEntries(entries: ActionLedgerEntry[]) {
  return [...entries].sort((a, b) => {
    const occurredAtDelta = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    if (occurredAtDelta !== 0) return occurredAtDelta
    return b.id.localeCompare(a.id)
  })
}

function buildBookingActionLedgerPage({
  bookingEntries,
  travelerEntries,
  itemEntries = [],
  limit,
}: {
  bookingEntries: ActionLedgerEntry[]
  travelerEntries: ActionLedgerEntry[]
  itemEntries?: ActionLedgerEntry[]
  limit: number
}) {
  const entriesById = new Map<string, ActionLedgerEntry>()
  for (const entry of bookingEntries) {
    entriesById.set(entry.id, entry)
  }
  for (const entry of travelerEntries) {
    entriesById.set(entry.id, entry)
  }
  for (const entry of itemEntries) {
    entriesById.set(entry.id, entry)
  }

  const sortedEntries = sortBookingActionLedgerEntries([...entriesById.values()])
  const entries = sortedEntries.slice(0, limit)
  const lastEntry = entries.at(-1)
  const nextCursor =
    sortedEntries.length > limit && lastEntry ? toBookingActionLedgerCursor(lastEntry) : null

  return { entries, nextCursor }
}

async function listBookingActionLedger(c: Context<Env>) {
  const bookingId = c.req.param("id")
  if (!bookingId) {
    return c.json({ error: "Booking not found" }, 404)
  }

  const query = parseQuery(c, bookingActionLedgerQuerySchema)
  const limit = query.limit ?? 50
  const queryLimit = limit + 1

  const booking = await bookingsService.getBookingById(c.get("db"), bookingId)
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404)
  }

  const travelers = await bookingsService.listTravelers(c.get("db"), bookingId)
  const reveal = shouldRevealBookingPii({
    actor: c.get("actor"),
    scopes: c.get("scopes"),
    callerType: c.get("callerType"),
    isInternalRequest: c.get("isInternalRequest"),
    enforceRbac: isStaffRbacEnforced(c.env),
  })
  const visibleTravelers = reveal ? travelers : travelers.map((row) => redactTravelerIdentity(row))

  const travelerIds = travelers.map((traveler) => traveler.id)
  const items = await bookingsService.listItems(c.get("db"), bookingId)
  const itemIds = items.map((item) => item.id)
  const [bookingEntriesResult, travelerEntriesResult, itemEntriesResult] = await Promise.all([
    actionLedgerService.listEntries(c.get("db"), {
      targetType: "booking",
      targetId: bookingId,
      cursor: query.cursor,
      limit: queryLimit,
    }),
    travelerIds.length > 0
      ? actionLedgerService.listEntries(c.get("db"), {
          targetType: "booking_traveler",
          targetIds: travelerIds,
          cursor: query.cursor,
          limit: queryLimit,
        })
      : Promise.resolve({ entries: [], nextCursor: null }),
    itemIds.length > 0
      ? actionLedgerService.listEntries(c.get("db"), {
          targetType: "booking_item",
          targetIds: itemIds,
          cursor: query.cursor,
          limit: queryLimit,
        })
      : Promise.resolve({ entries: [], nextCursor: null }),
  ])

  const page = buildBookingActionLedgerPage({
    bookingEntries: bookingEntriesResult.entries,
    travelerEntries: travelerEntriesResult.entries,
    itemEntries: itemEntriesResult.entries,
    limit,
  })

  return c.json({
    data: page.entries.map(serializeBookingActionLedgerEntry),
    travelers: visibleTravelers.map((traveler) => ({
      id: traveler.id,
      firstName: traveler.firstName,
      lastName: traveler.lastName,
    })),
    pageInfo: {
      nextCursor: page.nextCursor,
    },
  } satisfies BookingActionLedgerListResponse)
}

function serializeBookingActionApproval(
  approval: NonNullable<Awaited<ReturnType<typeof actionLedgerService.getApproval>>>["approval"],
): ActionApprovalResponse {
  return {
    ...approval,
    expiresAt: approval.expiresAt ? serializeBookingActionLedgerDate(approval.expiresAt) : null,
    decidedAt: approval.decidedAt ? serializeBookingActionLedgerDate(approval.decidedAt) : null,
    createdAt: serializeBookingActionLedgerDate(approval.createdAt),
  }
}

function findBookingStatusCapability(capabilityId: string | null) {
  return Object.values(BOOKING_STATUS_CAPABILITIES).find(
    (capability) => capability.id === capabilityId,
  )
}

async function decideBookingActionApproval(c: Context<Env>) {
  const bookingId = c.req.param("id")
  const approvalId = c.req.param("approvalId")
  if (!bookingId || !approvalId) {
    return c.json({ error: "Action approval not found" }, 404)
  }

  if (!c.get("isInternalRequest") && !c.get("userId")) {
    return handleApiError(new UnauthorizedApiError(), c)
  }

  const body = await parseJsonBody(c, decideBookingActionApprovalBodySchema)
  const existing = await actionLedgerService.getApproval(c.get("db"), approvalId)
  if (!existing?.requestedAction?.entry) {
    return c.json({ error: "Action approval not found" }, 404)
  }

  const requestedAction = existing.requestedAction.entry
  if (requestedAction.targetType !== "booking" || requestedAction.targetId !== bookingId) {
    return c.json({ error: "Action approval not found" }, 404)
  }

  const capability = findBookingStatusCapability(requestedAction.capabilityId)
  if (!capability) {
    return c.json({ error: "Action approval is not a booking status approval" }, 409)
  }

  const access = evaluateActionLedgerCapabilityAccess({
    definition: capability,
    actor: c.get("actor"),
    callerType: c.get("callerType"),
    scopes: c.get("scopes"),
    isInternalRequest: c.get("isInternalRequest"),
  })

  if (!access.allowed) {
    return handleApiError(new ForbiddenApiError(), c)
  }

  try {
    const result = await decideActionLedgerApproval(c.get("db"), {
      context: getActionLedgerRequestContext(c),
      id: approvalId,
      status: body.status,
      actionName: "booking.status.approval.decide",
      actionVersion: capability.version,
      evaluatedRisk: requestedAction.evaluatedRisk,
      targetType: "booking",
      targetId: bookingId,
      routeOrToolName: "bookings.approvals.decide",
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      authorizationSource: access.authorizationSource,
    })

    if (!result) {
      return c.json({ error: "Action approval not found" }, 404)
    }

    return c.json({
      data: {
        approval: serializeBookingActionApproval(result.approval),
        decisionAction: serializeBookingActionLedgerEntry(result.decisionAction),
      },
    } satisfies BookingActionApprovalDecisionResponse)
  } catch (error) {
    if (error instanceof ActionApprovalDecisionConflictError) {
      return c.json(
        {
          error: "Action approval has already been decided",
          approvalId: error.approvalId,
          status: error.currentStatus,
        },
        409,
      )
    }
    throw error
  }
}

// ==========================================================================
// Bookings — method-chained for Hono RPC type inference
// ==========================================================================

export const bookingRoutes = new Hono<Env>()

  // ==========================================================================
  // Bookings CRUD
  // ==========================================================================

  // 1. GET / — List bookings
  .get("/", async (c) => {
    const query = parseQuery(c, bookingListQuerySchema)
    const result = await bookingsService.listBookings(c.get("db"), query)
    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
      enforceRbac: isStaffRbacEnforced(c.env),
    })
    await logBookingPiiAccess(c, {
      action: "read",
      outcome: "allowed",
      reason: reveal ? "list_reveal" : "list_redacted",
      metadata: { rowCount: result.data.length, reveal },
    })
    if (reveal) return c.json(result)
    return c.json({
      ...result,
      data: result.data.map((row) => redactBookingContact(row)),
    })
  })

  // 1a. POST /pricing-preview — Resolve a pricing snapshot without creating a session.
  .post("/pricing-preview", async (c) => {
    const body = await parseJsonBody(c, pricingPreviewSchema)
    const snapshot = await resolveSessionPricingSnapshot(c.get("db"), body.productId, {
      optionId: body.optionId ?? undefined,
      catalogId: body.catalogId ?? undefined,
      requirePublicProduct: false,
    })
    if (!snapshot) {
      return c.json({ error: "Pricing unavailable for this selection" }, 404)
    }
    return c.json({ data: snapshot })
  })

  // 1b. GET /aggregates — Pre-aggregated dashboard metrics. Served from a
  // read-through TTL snapshot so a warm dashboard load is one indexed read
  // instead of the full aggregate fan-out (#1629).
  .get("/aggregates", async (c) => {
    const query = parseQuery(c, bookingAggregatesQuerySchema)
    cacheDashboardAggregates(c)
    const snapshot = await readThroughAggregateSnapshot(c.get("db"), {
      key: aggregateSnapshotKey("bookings", "aggregates", query),
      ttlSeconds: DASHBOARD_AGGREGATES_TTL_SECONDS,
      compute: () => bookingsService.getBookingAggregates(c.get("db"), query),
    })
    return c.json({ data: snapshot.data })
  })

  // 1b. GET /overview — Internal/admin booking overview lookup
  .get("/overview", async (c) => {
    const overview = await publicBookingsService.getOverviewByLookup(
      c.get("db"),
      parseQuery(c, internalBookingOverviewLookupQuerySchema),
    )

    if (!overview) {
      return c.json({ error: "Booking overview not found" }, 404)
    }

    return c.json({ data: overview })
  })

  .get("/sharing-groups", async (c) => {
    const query = parseQuery(c, sharingGroupsForSlotQuerySchema)
    const data = await bookingsService.listSharingGroupsForSlot(c.get("db"), query.slotId)
    return c.json({ data })
  })

  .get("/sharing-groups/:groupId/travelers", async (c) => {
    const query = parseQuery(c, sharingGroupsForSlotQuerySchema)
    const data = await bookingsService.listTravelersBySharingGroup(
      c.get("db"),
      query.slotId,
      c.req.param("groupId"),
    )
    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
      enforceRbac: isStaffRbacEnforced(c.env),
    })
    await logBookingPiiAccess(c, {
      action: "read",
      outcome: "allowed",
      reason: reveal ? "sharing_group_travelers_reveal" : "sharing_group_travelers_redacted",
      metadata: { rowCount: data.length, reveal },
    })
    return c.json({ data: reveal ? data : data.map((row) => redactTravelerIdentity(row)) })
  })

  // 2. GET /:id — Get single booking
  .get("/:id", async (c) => {
    const row = await bookingsService.getBookingById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
      enforceRbac: isStaffRbacEnforced(c.env),
    })
    await logBookingPiiAccess(c, {
      bookingId: row.id,
      action: "read",
      outcome: "allowed",
      reason: reveal ? "detail_reveal" : "detail_redacted",
      metadata: { reveal },
    })
    return c.json({ data: reveal ? row : redactBookingContact(row) })
  })

  // 2b. GET /:id/action-ledger — Booking-scoped action timeline
  .get("/:id/action-ledger", listBookingActionLedger)

  // 2c. POST /:id/action-approvals/:approvalId/decide — Booking-scoped approval decision
  .post("/:id/action-approvals/:approvalId/decide", decideBookingActionApproval)

  // 3. POST /reserve — Reserve inventory and create on-hold booking
  .post("/reserve", idempotencyKey({ scope: "POST /v1/admin/bookings/reserve" }), async (c) => {
    const data = await parseJsonBody(c, reserveBookingSchema)
    await validateBookingBillingPartyReferences(c, data)

    const result = await bookingsService.reserveBooking(c.get("db"), data, c.get("userId"))

    if ("booking" in result) {
      return c.json({ data: result.booking }, 201)
    }

    if (result.status === "slot_not_found") {
      return c.json({ error: "Availability slot not found" }, 404)
    }

    if (result.status === "insufficient_capacity") {
      return c.json({ error: "Insufficient slot capacity" }, 409)
    }

    if (result.status === "slot_unavailable") {
      return c.json({ error: "Availability slot is not bookable" }, 409)
    }

    if (result.status === "slot_product_mismatch" || result.status === "slot_option_mismatch") {
      return c.json({ error: "Reservation item does not match availability slot" }, 409)
    }

    return c.json({ error: "Unable to reserve booking" }, 400)
  })

  // 3a. POST /from-product — Create booking draft from product definition
  .post(
    "/from-product",
    idempotencyKey({ scope: "POST /v1/admin/bookings/from-product" }),
    async (c) => {
      const data = await parseJsonBody(c, convertProductSchema)
      await validateBookingBillingPartyReferences(c, data)

      const row = await bookingsService.createBookingFromProduct(c.get("db"), data, c.get("userId"))

      if (!row) {
        return c.json({ error: "Product or option not found" }, 404)
      }

      return c.json({ data: row }, 201)
    },
  )

  // 4. POST / — Create booking (manual/backoffice only)
  .post("/", idempotencyKey({ scope: "POST /v1/admin/bookings" }), async (c) => {
    try {
      const data = await parseJsonBody(c, createBookingSchema, {
        invalidBodyMessage: "Invalid booking create payload",
      })
      await validateBookingCustomFields(c, data, "create")
      await validateBookingBillingPartyReferences(c, data)

      return c.json(
        {
          data: await bookingsService.createBooking(c.get("db"), data, c.get("userId")),
        },
        201,
      )
    } catch (error) {
      const validationError = normalizeValidationError(error)

      if (validationError?.status === 400) {
        return c.json(
          {
            error: validationError.message,
            details: validationError.details?.fields ?? validationError.details,
          },
          400,
        )
      }

      throw error
    }
  })

  // 5. PATCH /:id — Update booking
  .patch("/:id", async (c) => {
    const data = await parseJsonBody(c, updateBookingSchema)
    await validateBookingCustomFields(c, data, "update")
    await validateBookingBillingPartyReferences(c, data)

    const row = await bookingsService.updateBooking(c.get("db"), c.req.param("id"), data)

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row })
  })

  // 6. DELETE /:id — Delete booking
  .delete("/:id", async (c) => {
    const row = await bookingsService.deleteBooking(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Status
  // ==========================================================================

  // 8. POST /:id/confirm — Confirm an on-hold booking
  .post("/:id/confirm", async (c) => {
    const bookingId = c.req.param("id")
    const data = await parseJsonBody(c, confirmBookingSchema)
    const auth = await authorizeBookingStatusMutation(c, {
      key: "confirm",
      actionName: "booking.status.confirm",
      routeOrToolName: "bookings.confirm",
      bookingId,
    })
    if (!auth.allowed) return auth.response

    const result = await bookingsService.confirmBooking(
      c.get("db"),
      bookingId,
      data,
      c.get("userId"),
      bookingStatusMutationRuntime(c, auth),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "hold_expired") {
      return c.json({ error: "Booking hold has expired" }, 409)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an on-hold state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to confirm booking" }, 400)
  })

  // 9. POST /:id/extend-hold — Extend booking hold expiry
  .post("/:id/extend-hold", async (c) => {
    const result = await bookingsService.extendBookingHold(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, extendBookingHoldSchema),
      c.get("userId"),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "hold_expired") {
      return c.json({ error: "Booking hold has expired" }, 409)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an on-hold state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to extend booking hold" }, 400)
  })

  // 10. POST /:id/expire — Expire an on-hold booking
  .post("/:id/expire", async (c) => {
    const bookingId = c.req.param("id")
    const data = await parseJsonBody(c, expireBookingSchema)
    const auth = await authorizeBookingStatusMutation(c, {
      key: "expire",
      actionName: "booking.status.expire",
      routeOrToolName: "bookings.expire",
      bookingId,
    })
    if (!auth.allowed) return auth.response

    const result = await bookingsService.expireBooking(
      c.get("db"),
      bookingId,
      data,
      c.get("userId"),
      {
        ...bookingStatusMutationRuntime(c, auth),
        cause: "route",
      },
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an on-hold state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to expire booking" }, 400)
  })

  // 10b. POST /expire-stale — Expire all stale on-hold bookings up to a cutoff
  .post("/expire-stale", async (c) => {
    return c.json(
      await bookingsService.expireStaleBookings(
        c.get("db"),
        await parseJsonBody(c, expireStaleBookingsSchema),
        c.get("userId"),
        {
          eventBus: c.get("eventBus"),
          closePaymentSchedulesForBooking: getRouteRuntime(c).closePaymentSchedulesForBooking,
        },
      ),
    )
  })

  // 11. POST /:id/cancel — Cancel a booking and release allocations
  .post("/:id/cancel", async (c) => {
    const bookingId = c.req.param("id")
    const data = await parseJsonBody(c, cancelBookingSchema)
    const auth = await authorizeBookingStatusMutation(c, {
      key: "cancel",
      actionName: "booking.status.cancel",
      routeOrToolName: "bookings.cancel",
      bookingId,
      commandInput: data,
    })
    if (!auth.allowed) return auth.response

    const result = await bookingsService.cancelBooking(
      c.get("db"),
      bookingId,
      data,
      c.get("userId"),
      bookingStatusMutationRuntime(c, auth),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking cannot be cancelled from its current state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to cancel booking" }, 400)
  })

  // 11a. POST /:id/start — Mark a confirmed booking as in-progress
  .post("/:id/start", async (c) => {
    const bookingId = c.req.param("id")
    const data = await parseJsonBody(c, startBookingSchema)
    const auth = await authorizeBookingStatusMutation(c, {
      key: "start",
      actionName: "booking.status.start",
      routeOrToolName: "bookings.start",
      bookingId,
    })
    if (!auth.allowed) return auth.response

    const result = await bookingsService.startBooking(
      c.get("db"),
      bookingId,
      data,
      c.get("userId"),
      bookingStatusMutationRuntime(c, auth),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in a confirmed state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to start booking" }, 400)
  })

  // 11b. POST /:id/complete — Mark an in-progress booking as completed
  .post("/:id/complete", async (c) => {
    const bookingId = c.req.param("id")
    const data = await parseJsonBody(c, completeBookingSchema)
    const auth = await authorizeBookingStatusMutation(c, {
      key: "complete",
      actionName: "booking.status.complete",
      routeOrToolName: "bookings.complete",
      bookingId,
    })
    if (!auth.allowed) return auth.response

    const result = await bookingsService.completeBooking(
      c.get("db"),
      bookingId,
      data,
      c.get("userId"),
      bookingStatusMutationRuntime(c, auth),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if (result.status === "invalid_transition") {
      return c.json({ error: "Booking is not in an in-progress state" }, 409)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to complete booking" }, 400)
  })

  // 11c. POST /:id/override-status — Admin override that bypasses the
  // transition graph. Terminal overrides cascade to items and allocations;
  // non-terminal overrides remain booking-row data correction. Always emits
  // booking.status_overridden for audit. Confirmed overrides also emit
  // booking.confirmed unless suppressLifecycleEvents is true. Requires a
  // non-empty `reason`.
  .post("/:id/override-status", async (c) => {
    const bookingId = c.req.param("id")
    const data = await parseJsonBody(c, overrideBookingStatusSchema)
    const auth = await authorizeBookingStatusMutation(c, {
      key: "override",
      actionName: "booking.status.override",
      routeOrToolName: "bookings.override-status",
      bookingId,
      commandInput: data,
    })
    if (!auth.allowed) return auth.response

    const result = await bookingsService.overrideBookingStatus(
      c.get("db"),
      bookingId,
      data,
      c.get("userId"),
      bookingStatusMutationRuntime(c, auth),
    )

    if (result.status === "not_found") {
      return c.json({ error: "Booking not found" }, 404)
    }

    if ("booking" in result) {
      return c.json({ data: result.booking })
    }

    return c.json({ error: "Unable to override booking status" }, 400)
  })

  // 12. GET /:id/allocations — List booking allocations
  .get("/:id/allocations", async (c) => {
    return c.json({ data: await bookingsService.listAllocations(c.get("db"), c.req.param("id")) })
  })

  // ==========================================================================
  // Travelers
  // ==========================================================================

  .get("/:id/travelers", async (c) => {
    const travelers = await bookingsService.listTravelers(c.get("db"), c.req.param("id"))
    const reveal = shouldRevealBookingPii({
      actor: c.get("actor"),
      scopes: c.get("scopes"),
      callerType: c.get("callerType"),
      isInternalRequest: c.get("isInternalRequest"),
      enforceRbac: isStaffRbacEnforced(c.env),
    })
    await logBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      action: "read",
      outcome: "allowed",
      reason: reveal ? "travelers_reveal" : "travelers_redacted",
      metadata: { rowCount: travelers.length, reveal },
    })
    if (reveal) return c.json({ data: travelers })
    return c.json({ data: travelers.map((row) => redactTravelerIdentity(row)) })
  })

  /**
   * GET /:id/travelers/:travelerId/reveal
   *
   * Per-traveler unmasked read. The list endpoint masks PII for
   * non-superuser staff; this endpoint reveals on a single click so
   * the operator can confirm a phone / email when actually needed,
   * with the access logged as `traveler_reveal`. Authorization uses
   * the same policy as `/travel-details` (staff or `bookings-pii:read`
   * scope), so it Just Works for the dashboard's normal staff session.
   *
   * Returns 404 when the traveler isn't found, 403 when the caller
   * isn't authorized to see PII.
   */
  .get("/:id/travelers/:travelerId/reveal", async (c) => {
    const bookingId = c.req.param("id")
    const travelerId = c.req.param("travelerId")
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId,
      travelerId,
      action: "read",
    })
    if (!auth.allowed) return auth.response

    const traveler = await bookingsService.getTravelerRecordById(c.get("db"), bookingId, travelerId)
    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId,
        travelerId,
        action: "read",
        outcome: "denied",
        reason: "traveler_not_found",
      })
      await logBookingPiiReadActionLedger(c, {
        travelerId,
        status: "denied",
        reason: "traveler_not_found",
        routeOrToolName: "bookings.travelers.reveal",
        disclosureSummary: "Booking PII read denied before reveal",
        authorizationSource: auth.access?.authorizationSource,
        evaluatedRisk: auth.access?.evaluatedRisk,
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    let travelDetails: TravelerTravelDetails
    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      travelDetails = await ledgerSensitiveRead(
        c.get("db"),
        {
          context: getActionLedgerRequestContext(c),
          actionName: BOOKING_PII_READ_ACTION_NAME,
          actionVersion: BOOKING_PII_READ_ACTION_VERSION,
          status: "succeeded",
          evaluatedRisk: auth.access?.evaluatedRisk ?? "high",
          targetType: "booking_traveler",
          targetId: traveler.id,
          routeOrToolName: "bookings.travelers.reveal",
          capabilityId: BOOKING_PII_READ_CAPABILITY.id,
          capabilityVersion: BOOKING_PII_READ_CAPABILITY.version,
          authorizationSource: auth.access?.authorizationSource ?? BOOKING_PII_AUTHORIZATION_SOURCE,
          reasonCode: "traveler_reveal",
          disclosedFieldSet: [
            ...TRAVELER_IDENTITY_DISCLOSED_FIELDS,
            ...TRAVELER_TRAVEL_DETAIL_DISCLOSED_FIELDS,
          ],
          disclosureSummary: "Traveler identity reveal",
          decisionPolicy: BOOKING_PII_DECISION_POLICY,
        },
        () => pii.getTravelerTravelDetails(c.get("db"), traveler.id, c.get("userId")),
      )
    } catch (error) {
      return handleKmsConfigError(c, error)
    }

    await logBookingPiiAccess(c, {
      bookingId,
      travelerId,
      action: "read",
      outcome: "allowed",
      reason: "traveler_reveal",
    })

    return c.json({ data: { ...traveler, travelDetails } })
  })

  .get("/:id/travelers/:travelerId/travel-details", async (c) => {
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      travelerId: c.req.param("travelerId"),
      action: "read",
    })
    if (!auth.allowed) {
      return auth.response
    }

    const traveler = await bookingsService.getTravelerRecordById(
      c.get("db"),
      c.req.param("id"),
      c.req.param("travelerId"),
    )

    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId: c.req.param("id"),
        travelerId: c.req.param("travelerId"),
        action: "read",
        outcome: "denied",
        reason: "participant_not_found",
      })
      await logBookingPiiReadActionLedger(c, {
        travelerId: c.req.param("travelerId"),
        status: "denied",
        reason: "participant_not_found",
        routeOrToolName: "bookings.travelers.travel-details",
        disclosureSummary: "Booking PII read denied before reveal",
        authorizationSource: auth.access?.authorizationSource,
        evaluatedRisk: auth.access?.evaluatedRisk,
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    let details: TravelerTravelDetails
    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      details = await ledgerSensitiveRead(
        c.get("db"),
        {
          context: getActionLedgerRequestContext(c),
          actionName: BOOKING_PII_READ_ACTION_NAME,
          actionVersion: BOOKING_PII_READ_ACTION_VERSION,
          status: "succeeded",
          evaluatedRisk: auth.access?.evaluatedRisk ?? "high",
          targetType: "booking_traveler",
          targetId: traveler.id,
          routeOrToolName: "bookings.travelers.travel-details",
          capabilityId: BOOKING_PII_READ_CAPABILITY.id,
          capabilityVersion: BOOKING_PII_READ_CAPABILITY.version,
          authorizationSource: auth.access?.authorizationSource ?? BOOKING_PII_AUTHORIZATION_SOURCE,
          reasonCode: "travel_details_reveal",
          disclosedFieldSet: TRAVELER_TRAVEL_DETAIL_DISCLOSED_FIELDS,
          disclosureSummary: "Traveler travel details reveal",
          decisionPolicy: BOOKING_PII_DECISION_POLICY,
        },
        () => pii.getTravelerTravelDetails(c.get("db"), traveler.id, c.get("userId")),
      )
    } catch (error) {
      return handleKmsConfigError(c, error)
    }

    if (!details) {
      await logBookingPiiAccess(c, {
        bookingId: traveler.bookingId,
        travelerId: traveler.id,
        action: "read",
        outcome: "denied",
        reason: "travel_details_not_found",
      })
      return c.json({ error: "Traveler travel details not found" }, 404)
    }

    return c.json({ data: details })
  })

  .post("/:id/travelers", async (c) => {
    const body = await parseJsonBody(c, insertTravelerSchema)
    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const txDb = tx as PostgresJsDatabase
      const row = await bookingsService.createTraveler(
        txDb,
        c.req.param("id"),
        body,
        c.get("userId"),
      )

      if (!row) return null

      await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "create",
        travelerId: row.id,
        changedFields: changedBookingTravelerFields(body, null, row),
        subject: "booking traveler",
        actionName: "booking.traveler.create",
        routeOrToolName: "bookings.travelers.create",
        evaluatedRisk: "high",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  /**
   * Combined "create traveler + write encrypted travel details" path.
   * When `data.personId` is provided AND a `resolveTravelSnapshot`
   * resolver is wired on the runtime, the route auto-snapshots
   * dietary / accessibility / primary-passport from the linked
   * person record. Explicit input always wins over snapshot.
   */
  .post("/:id/travelers/with-travel-details", async (c) => {
    try {
      const data = await parseJsonBody(c, createTravelerWithTravelDetailsSchema)
      const runtime = getRouteRuntime(c)
      const kms = await runtime.getKmsProvider()
      const pii = await createAuditedBookingPiiService(c, c.req.param("id"))
      const ledgerContext = getActionLedgerRequestContext(c)
      const result = await c.get("db").transaction(async (tx) => {
        const txDb = tx as PostgresJsDatabase
        const result = await bookingsService.createTravelerWithTravelDetails(
          txDb,
          c.req.param("id"),
          data,
          {
            pii,
            userId: c.get("userId"),
            actorId: c.get("userId"),
            resolveTravelSnapshot: runtime.resolveTravelSnapshot
              ? (personId) => runtime.resolveTravelSnapshot!(txDb, personId, { kms })
              : undefined,
          },
        )
        if (!result) return null

        await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
          action: "create",
          travelerId: result.traveler.id,
          changedFields: [
            ...new Set([
              ...changedBookingTravelerFields(data, null, result.traveler),
              ...changedBookingTravelDetailFields(data),
            ]),
          ].sort(),
          subject: "booking traveler with travel details",
          actionName: "booking.traveler_with_travel_details.create",
          routeOrToolName: "bookings.travelers.with-travel-details.create",
          evaluatedRisk: "high",
        })

        return result
      })
      if (!result) {
        return c.json({ error: "Booking not found" }, 404)
      }
      return c.json({ data: result }, 201)
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  /**
   * Combined "update traveler + (re-)write encrypted travel details"
   * path. Snapshot-on-update is intentionally NOT wired here — once a
   * booking is open, the traveler row is its own source of truth and
   * person-record edits should not retroactively rewrite trip data.
   */
  .patch("/:id/travelers/:travelerId/with-travel-details", async (c) => {
    try {
      const bookingId = c.req.param("id")
      const travelerId = c.req.param("travelerId")
      // Enforce booking↔traveler pairing before delegating to the
      // service, which writes by traveler id only. Without this guard
      // a caller could pass /bookings/A/travelers/<traveler-from-B>
      // and write to B while the audit/PII context is built from A.
      const traveler = await bookingsService.getTravelerRecordById(
        c.get("db"),
        bookingId,
        travelerId,
      )
      if (!traveler) {
        return c.json({ error: "Traveler not found" }, 404)
      }

      const data = await parseJsonBody(c, updateTravelerWithTravelDetailsSchema)
      const pii = await createAuditedBookingPiiService(c, bookingId)
      const ledgerContext = getActionLedgerRequestContext(c)
      const result = await c.get("db").transaction(async (tx) => {
        const result = await bookingsService.updateTravelerWithTravelDetails(
          tx as PostgresJsDatabase,
          travelerId,
          data,
          { pii, actorId: c.get("userId") },
        )
        if (!result) return null

        await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
          action: "update",
          travelerId: result.traveler.id,
          changedFields: [
            ...new Set([
              ...changedBookingTravelerFields(data, traveler, result.traveler),
              ...changedBookingTravelDetailFields(data),
            ]),
          ].sort(),
          subject: "booking traveler with travel details",
          actionName: "booking.traveler_with_travel_details.update",
          routeOrToolName: "bookings.travelers.with-travel-details.update",
          evaluatedRisk: "high",
        })

        return result
      })
      if (!result) {
        return c.json({ error: "Traveler not found" }, 404)
      }
      return c.json({ data: result })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .patch("/:id/travelers/:travelerId/travel-details", async (c) => {
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      travelerId: c.req.param("travelerId"),
      action: "update",
    })
    if (!auth.allowed) {
      return auth.response
    }

    const traveler = await bookingsService.getTravelerRecordById(
      c.get("db"),
      c.req.param("id"),
      c.req.param("travelerId"),
    )

    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId: c.req.param("id"),
        travelerId: c.req.param("travelerId"),
        action: "update",
        outcome: "denied",
        reason: "participant_not_found",
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const body = await parseJsonBody(c, upsertTravelerTravelDetailsSchema)
      const ledgerContext = getActionLedgerRequestContext(c)
      const row = await c.get("db").transaction(async (tx) => {
        const row = await pii.upsertTravelerTravelDetails(
          tx as PostgresJsDatabase,
          traveler.id,
          body,
          c.get("userId"),
        )

        if (!row) return null

        await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
          action: "update",
          travelerId: traveler.id,
          changedFields: changedBookingTravelDetailFields(body),
          subject: "booking traveler travel details",
          actionName: "booking.traveler_travel_details.update",
          routeOrToolName: "bookings.travelers.travel-details.update",
          evaluatedRisk: "high",
        })

        return row
      })

      if (!row) {
        return c.json({ error: "Traveler not found" }, 404)
      }

      return c.json({ data: row })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .patch("/:id/travelers/:travelerId", async (c) => {
    const bookingId = c.req.param("id")
    const travelerId = c.req.param("travelerId")
    const before = await bookingsService.getTravelerRecordById(c.get("db"), bookingId, travelerId)
    if (!before) {
      return c.json({ error: "Traveler not found" }, 404)
    }

    const body = await parseJsonBody(c, updateTravelerSchema)
    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.updateTraveler(tx as PostgresJsDatabase, travelerId, body)

      if (!row) return null

      await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "update",
        travelerId: row.id,
        changedFields: changedBookingTravelerFields(body, before, row),
        subject: "booking traveler",
        actionName: "booking.traveler.update",
        routeOrToolName: "bookings.travelers.update",
        evaluatedRisk: "high",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Traveler not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/:id/travelers/:travelerId/travel-details", async (c) => {
    const auth = await authorizeBookingPiiAccess(c, {
      bookingId: c.req.param("id"),
      travelerId: c.req.param("travelerId"),
      action: "delete",
    })
    if (!auth.allowed) {
      return auth.response
    }

    const traveler = await bookingsService.getTravelerRecordById(
      c.get("db"),
      c.req.param("id"),
      c.req.param("travelerId"),
    )

    if (!traveler) {
      await logBookingPiiAccess(c, {
        bookingId: c.req.param("id"),
        travelerId: c.req.param("travelerId"),
        action: "delete",
        outcome: "denied",
        reason: "participant_not_found",
      })
      return c.json({ error: "Traveler not found" }, 404)
    }

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const ledgerContext = getActionLedgerRequestContext(c)
      const row = await c.get("db").transaction(async (tx) => {
        const row = await pii.deleteTravelerTravelDetails(
          tx as PostgresJsDatabase,
          traveler.id,
          c.get("userId"),
        )

        if (!row) return null

        await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
          action: "delete",
          travelerId: traveler.id,
          changedFields: [],
          subject: "booking traveler travel details",
          actionName: "booking.traveler_travel_details.delete",
          routeOrToolName: "bookings.travelers.travel-details.delete",
          evaluatedRisk: "high",
        })

        return row
      })

      if (!row) {
        return c.json({ error: "Traveler travel details not found" }, 404)
      }

      return c.json({ success: true }, 200)
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .delete("/:id/travelers/:travelerId", async (c) => {
    const bookingId = c.req.param("id")
    const travelerId = c.req.param("travelerId")
    const before = await bookingsService.getTravelerRecordById(c.get("db"), bookingId, travelerId)
    if (!before) {
      return c.json({ error: "Traveler not found" }, 404)
    }

    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.deleteTraveler(tx as PostgresJsDatabase, travelerId)

      if (!row) return null

      await appendBookingTravelerMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "delete",
        travelerId,
        changedFields: [],
        subject: "booking traveler",
        actionName: "booking.traveler.delete",
        routeOrToolName: "bookings.travelers.delete",
        evaluatedRisk: "high",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Traveler not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Items
  // ==========================================================================

  // 16. GET /:id/items — List booking items
  .get("/:id/items", async (c) => {
    return c.json({ data: await bookingsService.listItems(c.get("db"), c.req.param("id")) })
  })

  // 17. POST /:id/items — Add booking item
  .post("/:id/items", async (c) => {
    const body = await parseJsonBody(c, insertBookingItemSchema)
    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.createItem(
        tx as PostgresJsDatabase,
        c.req.param("id"),
        body,
        c.get("userId"),
      )

      if (!row) return null

      await appendBookingMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "create",
        actionName: "booking.item.create",
        actionVersion: BOOKING_ITEM_LEDGER_ACTION_VERSION,
        targetType: "booking_item",
        targetId: row.id,
        changedFields: changedBookingItemFields(body, null, row),
        subject: "booking item",
        routeOrToolName: "bookings.items.create",
        evaluatedRisk: "high",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 18. PATCH /:id/items/:itemId — Update booking item
  .patch("/:id/items/:itemId", async (c) => {
    const bookingId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const before =
      (await bookingsService.listItems(c.get("db"), bookingId)).find(
        (item) => item.id === itemId,
      ) ?? null

    if (!before) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    const body = await parseJsonBody(c, updateBookingItemSchema)
    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.updateItem(tx as PostgresJsDatabase, itemId, body)

      if (!row) return null

      await appendBookingMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "update",
        actionName: "booking.item.update",
        actionVersion: BOOKING_ITEM_LEDGER_ACTION_VERSION,
        targetType: "booking_item",
        targetId: row.id,
        changedFields: changedBookingItemFields(body, before, row),
        subject: "booking item",
        routeOrToolName: "bookings.items.update",
        evaluatedRisk: "high",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ data: row })
  })

  // 19. DELETE /:id/items/:itemId — Delete booking item
  .delete("/:id/items/:itemId", async (c) => {
    const bookingId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const before =
      (await bookingsService.listItems(c.get("db"), bookingId)).find(
        (item) => item.id === itemId,
      ) ?? null

    if (!before) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.deleteItem(tx as PostgresJsDatabase, itemId)

      if (!row) return null

      await appendBookingMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "delete",
        actionName: "booking.item.delete",
        actionVersion: BOOKING_ITEM_LEDGER_ACTION_VERSION,
        targetType: "booking_item",
        targetId: itemId,
        changedFields: [],
        subject: "booking item",
        routeOrToolName: "bookings.items.delete",
        evaluatedRisk: "high",
        summary: "Deleted booking item",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // 20. GET /:id/items/:itemId/travelers — List item travelers
  .get("/:id/items/:itemId/travelers", async (c) => {
    return c.json({
      data: await bookingsService.listItemParticipants(c.get("db"), c.req.param("itemId")),
    })
  })

  // 21. POST /:id/items/:itemId/travelers — Link traveler to item
  .post("/:id/items/:itemId/travelers", async (c) => {
    const bookingId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const item =
      (await bookingsService.listItems(c.get("db"), bookingId)).find((row) => row.id === itemId) ??
      null

    if (!item) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    const body = await parseJsonBody(c, insertBookingItemTravelerSchema)
    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.addItemParticipant(tx as PostgresJsDatabase, itemId, body)

      if (!row) return null

      await appendBookingMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "create",
        actionName: "booking.item_traveler.create",
        actionVersion: BOOKING_ITEM_LEDGER_ACTION_VERSION,
        targetType: "booking_item",
        targetId: itemId,
        changedFields: changedBookingItemFields(body, null, row),
        subject: "booking item traveler link",
        routeOrToolName: "bookings.items.travelers.create",
        evaluatedRisk: "high",
        summary: "Linked traveler to booking item",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Booking item or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 22. DELETE /:id/items/:itemId/travelers/:linkId — Unlink traveler from item
  .delete("/:id/items/:itemId/travelers/:linkId", async (c) => {
    const bookingId = c.req.param("id")
    const itemId = c.req.param("itemId")
    const linkId = c.req.param("linkId")
    const item =
      (await bookingsService.listItems(c.get("db"), bookingId)).find((row) => row.id === itemId) ??
      null

    if (!item) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    const before =
      (await bookingsService.listItemParticipants(c.get("db"), itemId)).find(
        (link) => link.id === linkId,
      ) ?? null

    if (!before) {
      return c.json({ error: "Booking item traveler link not found" }, 404)
    }

    const ledgerContext = getActionLedgerRequestContext(c)
    const row = await c.get("db").transaction(async (tx) => {
      const row = await bookingsService.removeItemParticipant(tx as PostgresJsDatabase, linkId)

      if (!row) return null

      await appendBookingMutationLedgerEntryToDb(tx as AnyDrizzleDb, ledgerContext, {
        action: "delete",
        actionName: "booking.item_traveler.delete",
        actionVersion: BOOKING_ITEM_LEDGER_ACTION_VERSION,
        targetType: "booking_item",
        targetId: itemId,
        changedFields: [],
        subject: "booking item traveler link",
        routeOrToolName: "bookings.items.travelers.delete",
        evaluatedRisk: "high",
        summary: "Unlinked traveler from booking item",
      })

      return row
    })

    if (!row) {
      return c.json({ error: "Booking item traveler link not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Supplier Statuses
  // ==========================================================================

  .get("/:id/supplier-statuses", async (c) => {
    return c.json({
      data: await bookingsService.listSupplierStatuses(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/supplier-statuses", async (c) => {
    const row = await bookingsService.createSupplierStatus(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertSupplierStatusSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/:id/supplier-statuses/:statusId", async (c) => {
    const row = await bookingsService.updateSupplierStatus(
      c.get("db"),
      c.req.param("id"),
      c.req.param("statusId"),
      await parseJsonBody(c, updateSupplierStatusSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Supplier status not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ==========================================================================
  // Fulfillment
  // ==========================================================================

  .get("/:id/fulfillments", async (c) => {
    return c.json({ data: await bookingsService.listFulfillments(c.get("db"), c.req.param("id")) })
  })

  .post("/:id/fulfillments", async (c) => {
    const row = await bookingsService.issueFulfillment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertBookingFulfillmentSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking, item, or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/:id/fulfillments/:fulfillmentId", async (c) => {
    const row = await bookingsService.updateFulfillment(
      c.get("db"),
      c.req.param("id"),
      c.req.param("fulfillmentId"),
      await parseJsonBody(c, updateBookingFulfillmentSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Fulfillment, item, or traveler not found" }, 404)
    }

    return c.json({ data: row })
  })

  // ==========================================================================
  // Redemption
  // ==========================================================================

  .get("/:id/redemptions", async (c) => {
    return c.json({
      data: await bookingsService.listRedemptionEvents(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/redemptions", async (c) => {
    const row = await bookingsService.recordRedemption(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, recordBookingRedemptionSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking, item, or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ==========================================================================
  // Activity Log
  // ==========================================================================

  // 26. GET /:id/activity — List activity log
  .get("/:id/activity", async (c) => {
    return c.json({ data: await bookingsService.listActivity(c.get("db"), c.req.param("id")) })
  })

  // 26a. GET /:id/group — Shared-room group membership for this booking (or null)
  .get("/:id/group", async (c) => {
    const result = await bookingGroupsService.getBookingGroupForBooking(
      c.get("db"),
      c.req.param("id"),
    )
    return c.json({ data: result ?? null })
  })

  // ==========================================================================
  // Notes
  // ==========================================================================

  // 27. GET /:id/notes — List notes
  .get("/:id/notes", async (c) => {
    return c.json({ data: await bookingsService.listNotes(c.get("db"), c.req.param("id")) })
  })

  // 28. POST /:id/notes — Add note
  .post("/:id/notes", async (c) => {
    const userId = requireUserId(c)
    const bookingId = c.req.param("id")
    const row = await bookingsService.createNote(
      c.get("db"),
      bookingId,
      userId,
      await parseJsonBody(c, insertBookingNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    await appendBookingMutationLedgerEntry(c, {
      action: "create",
      actionName: "booking.note.create",
      actionVersion: BOOKING_NOTE_LEDGER_ACTION_VERSION,
      targetType: "booking",
      targetId: bookingId,
      changedFields: ["content"],
      subject: "booking note",
      routeOrToolName: "bookings.notes.create",
      evaluatedRisk: "medium",
      summary: "Created booking note",
    })

    return c.json({ data: row }, 201)
  })

  // 28b. PATCH /:id/notes/:noteId — Edit note
  .patch("/:id/notes/:noteId", async (c) => {
    const bookingId = c.req.param("id")
    const noteId = c.req.param("noteId")
    const row = await bookingsService.updateNote(
      c.get("db"),
      bookingId,
      noteId,
      await parseJsonBody(c, updateBookingNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Note not found" }, 404)
    }

    await appendBookingMutationLedgerEntry(c, {
      action: "update",
      actionName: "booking.note.update",
      actionVersion: BOOKING_NOTE_LEDGER_ACTION_VERSION,
      targetType: "booking",
      targetId: bookingId,
      changedFields: ["content"],
      subject: "booking note",
      routeOrToolName: "bookings.notes.update",
      evaluatedRisk: "medium",
      summary: "Updated booking note",
    })

    return c.json({ data: row })
  })

  // 28c. DELETE /:id/notes/:noteId — Delete note
  .delete("/:id/notes/:noteId", async (c) => {
    const bookingId = c.req.param("id")
    const row = await bookingsService.deleteNote(c.get("db"), bookingId, c.req.param("noteId"))

    if (!row) {
      return c.json({ error: "Note not found" }, 404)
    }

    await appendBookingMutationLedgerEntry(c, {
      action: "delete",
      actionName: "booking.note.delete",
      actionVersion: BOOKING_NOTE_LEDGER_ACTION_VERSION,
      targetType: "booking",
      targetId: bookingId,
      changedFields: [],
      subject: "booking note",
      routeOrToolName: "bookings.notes.delete",
      evaluatedRisk: "medium",
      summary: "Deleted booking note",
    })

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Documents
  // ==========================================================================

  // 29. GET /:id/documents — List documents for booking
  .get("/:id/documents", async (c) => {
    return c.json({ data: await bookingsService.listDocuments(c.get("db"), c.req.param("id")) })
  })

  // 30. POST /:id/documents — Add document to booking
  .post("/:id/documents", async (c) => {
    const row = await bookingsService.createDocument(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertBookingDocumentSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 31. DELETE /:id/documents/:documentId — Delete document
  .delete("/:id/documents/:documentId", async (c) => {
    const row = await bookingsService.deleteDocument(c.get("db"), c.req.param("documentId"))

    if (!row) {
      return c.json({ error: "Document not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Booking Groups (shared-room / split-booking model)
  // ==========================================================================
  .route("/groups", bookingGroupRoutes)

export type BookingRoutes = typeof bookingRoutes
export type PublicBookingRoutes = typeof publicBookingRoutes

export const __test__ = {
  bookingActionLedgerQuerySchema,
  bookingMutationSummary,
  buildBookingActionLedgerPage,
  changedBookingItemFields,
  changedBookingMutationFields,
  changedBookingTravelDetailFields,
  changedBookingTravelerFields,
}
