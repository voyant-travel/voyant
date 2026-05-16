import {
  type ActionLedgerCapabilityAccessResult,
  ActionLedgerIdempotencyConflictError,
  type ActionLedgerRequestContextValues,
  actionLedgerService,
  appendActionLedgerMutation,
  appendActionLedgerSensitiveRead,
  buildIdempotencyFingerprint,
  evaluateActionLedgerApprovalRequirement,
  evaluateActionLedgerCapabilityAccess,
  mapActionLedgerRequestContext,
  requestActionLedgerApproval,
} from "@voyantjs/action-ledger"
import {
  ForbiddenApiError,
  handleApiError,
  idempotencyKey,
  normalizeValidationError,
  parseJsonBody,
  parseQuery,
  requireUserId,
  UnauthorizedApiError,
} from "@voyantjs/hono"
import { type Context, Hono } from "hono"

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
  reserveBookingFromTransactionSchema,
  reserveBookingSchema,
  sharingGroupsForSlotQuerySchema,
  startBookingSchema,
  updateBookingFulfillmentSchema,
  updateBookingItemSchema,
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
const ACTION_APPROVAL_ID_HEADER = "action-approval-id"

type ApprovedBookingStatusAction = {
  requestedActionId: string
  approvalId: string
  idempotencyFingerprint: string
}

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
  "passportNumber",
  "passportExpiry",
  "passportIssuingCountry",
  "passportIssuingAuthority",
  "passportPersonDocumentId",
  "dateOfBirth",
  "dietaryRequirements",
  "accessibilityNeeds",
  "isLeadTraveler",
  "sharingGroupId",
  "roomTypeId",
  "bedPreference",
  "allocations",
]

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
      const idempotencyFingerprint = idempotencyKey
        ? await buildIdempotencyFingerprint({
            actionName: input.actionName,
            actionVersion: capability.version,
            targetType: "booking",
            targetId: input.bookingId,
            commandInput: input.commandInput ?? null,
            policyInputs: {
              approvalPolicy: approvalRequirement.approvalPolicy,
              capabilityId: access.capabilityId,
              capabilityVersion: access.capabilityVersion,
              evaluatedRisk: approvalRequirement.evaluatedRisk,
              reasonCode: approvalRequirement.reasonCode,
            },
          })
        : null

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
  const approvalId = c.req.header(ACTION_APPROVAL_ID_HEADER)
  if (!approvalId) return null

  const executionFingerprint = await buildIdempotencyFingerprint({
    actionName: input.actionName,
    actionVersion: BOOKING_STATUS_CAPABILITIES[input.key].version,
    targetType: "booking",
    targetId: input.bookingId,
    commandInput: input.commandInput ?? null,
    policyInputs: {
      approvalPolicy: approvalRequirement.approvalPolicy,
      capabilityId: access.capabilityId,
      capabilityVersion: access.capabilityVersion,
      evaluatedRisk: approvalRequirement.evaluatedRisk,
      reasonCode: approvalRequirement.reasonCode,
    },
  })

  const actorFields = mapActionLedgerRequestContext(getActionLedgerRequestContext(c))
  const validation = await actionLedgerService.validateApprovedAction(c.get("db"), {
    approvalId,
    actionName: input.actionName,
    actionVersion: BOOKING_STATUS_CAPABILITIES[input.key].version,
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
}

function bookingStatusMutationRuntime(
  c: Context<Env>,
  auth: {
    access: ActionLedgerCapabilityAccessResult
    approvedAction?: ApprovedBookingStatusAction
  },
) {
  return {
    eventBus: c.get("eventBus"),
    actionLedgerContext: getActionLedgerRequestContext(c),
    actionLedgerAuthorizationSource: auth.access.authorizationSource,
    actionLedgerCausationActionId: auth.approvedAction?.requestedActionId ?? null,
    actionLedgerApprovalId: auth.approvedAction?.approvalId ?? null,
    actionLedgerIdempotencyScope: auth.approvedAction
      ? `${auth.approvedAction.approvalId}:execution`
      : null,
    actionLedgerIdempotencyKey: auth.approvedAction?.approvalId ?? null,
    actionLedgerIdempotencyFingerprint: auth.approvedAction?.idempotencyFingerprint ?? null,
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

function getRouteRuntime(c: Context<Env>): BookingRouteRuntime {
  try {
    return (
      c.var.container?.resolve<BookingRouteRuntime>(BOOKING_ROUTE_RUNTIME_CONTAINER_KEY) ??
      buildBookingRouteRuntime(c.env)
    )
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
    })
    if (!snapshot) {
      return c.json({ error: "Pricing unavailable for this selection" }, 404)
    }
    return c.json({ data: snapshot })
  })

  // 1b. GET /aggregates — Pre-aggregated dashboard metrics
  .get("/aggregates", async (c) => {
    const query = parseQuery(c, bookingAggregatesQuerySchema)
    return c.json({ data: await bookingsService.getBookingAggregates(c.get("db"), query) })
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

  // 3. POST /reserve — Reserve inventory and create on-hold booking
  .post("/reserve", idempotencyKey({ scope: "POST /v1/admin/bookings/reserve" }), async (c) => {
    const result = await bookingsService.reserveBooking(
      c.get("db"),
      await parseJsonBody(c, reserveBookingSchema),
      c.get("userId"),
    )

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
      const row = await bookingsService.createBookingFromProduct(
        c.get("db"),
        await parseJsonBody(c, convertProductSchema),
        c.get("userId"),
      )

      if (!row) {
        return c.json({ error: "Product or option not found" }, 404)
      }

      return c.json({ data: row }, 201)
    },
  )

  // 3b. POST /from-offer/:offerId/reserve — Reserve booking from transaction offer
  .post(
    "/from-offer/:offerId/reserve",
    idempotencyKey({ scope: "POST /v1/admin/bookings/from-offer" }),
    async (c) => {
      const result = await bookingsService.reserveBookingFromOffer(
        c.get("db"),
        c.req.param("offerId"),
        await parseJsonBody(c, reserveBookingFromTransactionSchema),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return c.json({ error: "Offer not found" }, 404)
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

      if ("booking" in result) {
        return c.json({ data: result.booking }, 201)
      }

      return c.json({ error: "Unable to reserve booking from offer" }, 400)
    },
  )

  // 3c. POST /from-order/:orderId/reserve — Reserve booking from transaction order
  .post(
    "/from-order/:orderId/reserve",
    idempotencyKey({ scope: "POST /v1/admin/bookings/from-order" }),
    async (c) => {
      const result = await bookingsService.reserveBookingFromOrder(
        c.get("db"),
        c.req.param("orderId"),
        await parseJsonBody(c, reserveBookingFromTransactionSchema),
        c.get("userId"),
      )

      if (result.status === "not_found") {
        return c.json({ error: "Order not found" }, 404)
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

      if ("booking" in result) {
        return c.json({ data: result.booking }, 201)
      }

      return c.json({ error: "Unable to reserve booking from order" }, 400)
    },
  )

  // 4. POST / — Create booking (manual/backoffice only)
  .post("/", idempotencyKey({ scope: "POST /v1/admin/bookings" }), async (c) => {
    try {
      return c.json(
        {
          data: await bookingsService.createBooking(
            c.get("db"),
            await parseJsonBody(c, createBookingSchema, {
              invalidBodyMessage: "Invalid booking create payload",
            }),
            c.get("userId"),
          ),
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
    const row = await bookingsService.updateBooking(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingSchema),
    )

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
        { eventBus: c.get("eventBus") },
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
  // transition graph. Updates the booking row only — no cascade to items,
  // allocations, or fulfillments. Always emits booking.status_overridden for
  // audit. Requires a non-empty `reason`.
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

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const travelDetails = await pii.getTravelerTravelDetails(
        c.get("db"),
        traveler.id,
        c.get("userId"),
      )

      await logBookingPiiAccess(c, {
        bookingId,
        travelerId,
        action: "read",
        outcome: "allowed",
        reason: "traveler_reveal",
      })

      await logBookingPiiReadActionLedger(c, {
        travelerId,
        status: "succeeded",
        reason: "traveler_reveal",
        routeOrToolName: "bookings.travelers.reveal",
        disclosedFieldSet: travelDetails
          ? [...TRAVELER_IDENTITY_DISCLOSED_FIELDS, ...TRAVELER_TRAVEL_DETAIL_DISCLOSED_FIELDS]
          : TRAVELER_IDENTITY_DISCLOSED_FIELDS,
        disclosureSummary: "Traveler identity reveal",
        authorizationSource: auth.access?.authorizationSource,
        evaluatedRisk: auth.access?.evaluatedRisk,
      })

      return c.json({ data: { ...traveler, travelDetails } })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
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

    try {
      const pii = await createAuditedBookingPiiService(c, traveler.bookingId)
      const details = await pii.getTravelerTravelDetails(c.get("db"), traveler.id, c.get("userId"))

      if (!details) {
        await logBookingPiiAccess(c, {
          bookingId: traveler.bookingId,
          travelerId: traveler.id,
          action: "read",
          outcome: "denied",
          reason: "travel_details_not_found",
        })
        await logBookingPiiReadActionLedger(c, {
          travelerId: traveler.id,
          status: "denied",
          reason: "travel_details_not_found",
          routeOrToolName: "bookings.travelers.travel-details",
          disclosureSummary: "Booking traveler travel details not found",
          authorizationSource: auth.access?.authorizationSource,
          evaluatedRisk: auth.access?.evaluatedRisk,
        })
        return c.json({ error: "Traveler travel details not found" }, 404)
      }

      await logBookingPiiReadActionLedger(c, {
        travelerId: traveler.id,
        status: "succeeded",
        reason: "travel_details_reveal",
        routeOrToolName: "bookings.travelers.travel-details",
        disclosedFieldSet: TRAVELER_TRAVEL_DETAIL_DISCLOSED_FIELDS,
        disclosureSummary: "Traveler travel details reveal",
        authorizationSource: auth.access?.authorizationSource,
        evaluatedRisk: auth.access?.evaluatedRisk,
      })

      return c.json({ data: details })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .post("/:id/travelers", async (c) => {
    const row = await bookingsService.createTraveler(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertTravelerSchema),
      c.get("userId"),
    )

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
      const result = await bookingsService.createTravelerWithTravelDetails(
        c.get("db"),
        c.req.param("id"),
        data,
        {
          pii,
          userId: c.get("userId"),
          actorId: c.get("userId"),
          resolveTravelSnapshot: runtime.resolveTravelSnapshot
            ? (personId) => runtime.resolveTravelSnapshot!(c.get("db"), personId, { kms })
            : undefined,
        },
      )
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
      const result = await bookingsService.updateTravelerWithTravelDetails(
        c.get("db"),
        travelerId,
        data,
        { pii, actorId: c.get("userId") },
      )
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
      const row = await pii.upsertTravelerTravelDetails(
        c.get("db"),
        traveler.id,
        await parseJsonBody(c, upsertTravelerTravelDetailsSchema),
        c.get("userId"),
      )

      if (!row) {
        return c.json({ error: "Traveler not found" }, 404)
      }

      return c.json({ data: row })
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .patch("/:id/travelers/:travelerId", async (c) => {
    const row = await bookingsService.updateTraveler(
      c.get("db"),
      c.req.param("travelerId"),
      await parseJsonBody(c, updateTravelerSchema),
    )

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
      const row = await pii.deleteTravelerTravelDetails(c.get("db"), traveler.id, c.get("userId"))

      if (!row) {
        return c.json({ error: "Traveler travel details not found" }, 404)
      }

      return c.json({ success: true }, 200)
    } catch (error) {
      return handleKmsConfigError(c, error)
    }
  })

  .delete("/:id/travelers/:travelerId", async (c) => {
    const row = await bookingsService.deleteTraveler(c.get("db"), c.req.param("travelerId"))

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
    const row = await bookingsService.createItem(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertBookingItemSchema),
      c.get("userId"),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 18. PATCH /:id/items/:itemId — Update booking item
  .patch("/:id/items/:itemId", async (c) => {
    const row = await bookingsService.updateItem(
      c.get("db"),
      c.req.param("itemId"),
      await parseJsonBody(c, updateBookingItemSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item not found" }, 404)
    }

    return c.json({ data: row })
  })

  // 19. DELETE /:id/items/:itemId — Delete booking item
  .delete("/:id/items/:itemId", async (c) => {
    const row = await bookingsService.deleteItem(c.get("db"), c.req.param("itemId"))

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
    const row = await bookingsService.addItemParticipant(
      c.get("db"),
      c.req.param("itemId"),
      await parseJsonBody(c, insertBookingItemTravelerSchema),
    )

    if (!row) {
      return c.json({ error: "Booking item or traveler not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 22. DELETE /:id/items/:itemId/travelers/:linkId — Unlink traveler from item
  .delete("/:id/items/:itemId/travelers/:linkId", async (c) => {
    const row = await bookingsService.removeItemParticipant(c.get("db"), c.req.param("linkId"))

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
    const row = await bookingsService.createNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertBookingNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Booking not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // 28b. DELETE /:id/notes/:noteId — Delete note
  .delete("/:id/notes/:noteId", async (c) => {
    const row = await bookingsService.deleteNote(c.get("db"), c.req.param("noteId"))

    if (!row) {
      return c.json({ error: "Note not found" }, 404)
    }

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
