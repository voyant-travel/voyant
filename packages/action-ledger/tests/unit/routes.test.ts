import type { AnyDrizzleDb } from "@voyantjs/db"
import { Hono } from "hono"
import { afterEach, describe, expect, test, vi } from "vitest"

import { __test__, actionLedgerAdminRoutes } from "../../src/routes.js"
import type {
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionLedgerRelayOutbox,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
} from "../../src/schema.js"
import { actionLedgerService } from "../../src/service.js"

const baseDate = new Date("2026-05-15T10:00:00.000Z")

function makeEntry(overrides: Partial<ActionLedgerEntry> = {}): ActionLedgerEntry {
  return {
    id: "alge_1",
    occurredAt: baseDate,
    actionName: "booking.pii.read",
    actionVersion: "v1",
    actionKind: "read",
    status: "succeeded",
    evaluatedRisk: "high",
    actorType: "staff",
    principalType: "user",
    principalId: "usr_1",
    principalSubtype: null,
    sessionId: "sess_1",
    apiTokenId: null,
    internalRequest: false,
    delegatedByPrincipalType: null,
    delegatedByPrincipalId: null,
    delegationId: null,
    callerType: "session",
    organizationId: "org_1",
    routeOrToolName: "bookings.travel-details",
    workflowRunId: null,
    workflowStepId: null,
    correlationId: "corr_1",
    causationActionId: null,
    idempotencyScope: null,
    idempotencyKey: null,
    idempotencyFingerprint: null,
    targetType: "booking_traveler",
    targetId: "bkpt_1",
    capabilityId: null,
    capabilityVersion: null,
    authorizationSource: null,
    approvalId: null,
    amendsActionId: null,
    createdAt: baseDate,
    ...overrides,
  }
}

function makeMutationDetail(overrides: Partial<ActionMutationDetail> = {}): ActionMutationDetail {
  return {
    actionId: "alge_1",
    commandInputRef: null,
    commandResultRef: null,
    summary: "Booking status changed from on_hold to confirmed",
    reversalKind: "none",
    reversalCommandId: null,
    reversalCommandVersion: null,
    reversalArgsRef: null,
    reversalStateProjection: null,
    reversalOutcomeProjection: null,
    reversesActionId: null,
    reversedByActionIdProjection: null,
    ...overrides,
  }
}

function makeSensitiveReadDetail(
  overrides: Partial<ActionSensitiveReadDetail> = {},
): ActionSensitiveReadDetail {
  return {
    actionId: "alge_1",
    reasonCode: "travel_details_reveal",
    disclosedFieldSet: ["passportNumber"],
    disclosureSummary: "Travel document details disclosed",
    decisionPolicy: "bookings-pii-scope-or-staff-v1",
    ...overrides,
  }
}

function makePayload(overrides: Partial<ActionLedgerPayload> = {}): ActionLedgerPayload {
  return {
    id: "alpa_1",
    actionId: "alge_1",
    payloadKind: "command_input",
    schemaTag: "booking.status.confirm:v1",
    redactionStatus: "none",
    retentionPolicy: "audit-default",
    storageRef: "blob://action-ledger/alge_1/input",
    hash: "sha256:payload",
    createdAt: baseDate,
    expiresAt: new Date("2026-06-15T10:00:00.000Z"),
    ...overrides,
  }
}

function makeRelayOutbox(
  overrides: Partial<ActionLedgerRelayOutbox> = {},
): ActionLedgerRelayOutbox {
  return {
    id: "alro_1",
    actionId: "alge_1",
    organizationId: "org_1",
    relayStatus: "pending",
    payloadRef: "blob://action-ledger/alge_1",
    attemptCount: 0,
    nextRetryAt: new Date("2026-05-15T10:05:00.000Z"),
    lastError: null,
    createdAt: baseDate,
    processedAt: null,
    ...overrides,
  }
}

function makeApp(db: AnyDrizzleDb) {
  const app = new Hono<{
    Variables: {
      db: AnyDrizzleDb
    }
  }>()

  app.use("*", async (c, next) => {
    c.set("db", db)
    await next()
  })

  return app.route("/", actionLedgerAdminRoutes)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("actionLedgerAdminRoutes", () => {
  test("lists entries with composed filters and cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listEntries").mockResolvedValue({
      entries: [makeEntry()],
      nextCursor: {
        occurredAt: "2026-05-15T10:00:00.000Z",
        id: "alge_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/entries?actionName=booking.status.confirm&actionKind=update&actorType=staff&principalType=user&principalId=usr_1&apiTokenId=key_1&sessionId=sess_1&callerType=session&organizationId=org_1&targetType=booking&targetId=book_1&routeOrToolName=bookings.confirm&workflowRunId=wf_run_1&workflowStepId=wf_step_1&correlationId=corr_1&causationActionId=alge_parent&capabilityId=bookings%3Astatus%3Aconfirm&capabilityVersion=v1&authorizationSource=bookings.status.route&approvalId=appr_1&amendsActionId=alge_prior&idempotencyScope=booking&idempotencyKey=idem_1&evaluatedRisk=high,critical&status=succeeded,denied&reversalKind=domain_command,compensate&reversalState=available,requested&reversalOutcome=partial&reversesActionId=alge_original&reversedByActionId=alge_reversal&sensitiveReasonCode=travel_details_reveal&decisionPolicy=bookings-pii-scope-or-staff-v1&occurredAtFrom=2026-05-15T09%3A00%3A00.000Z&occurredAtTo=2026-05-15T10%3A00%3A00.000Z&cursorOccurredAt=2026-05-15T10%3A00%3A00.000Z&cursorId=alge_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      actionName: "booking.status.confirm",
      actionKind: "update",
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      apiTokenId: "key_1",
      sessionId: "sess_1",
      callerType: "session",
      organizationId: "org_1",
      targetType: "booking",
      targetId: "book_1",
      routeOrToolName: "bookings.confirm",
      workflowRunId: "wf_run_1",
      workflowStepId: "wf_step_1",
      correlationId: "corr_1",
      causationActionId: "alge_parent",
      capabilityId: "bookings:status:confirm",
      capabilityVersion: "v1",
      authorizationSource: "bookings.status.route",
      approvalId: "appr_1",
      amendsActionId: "alge_prior",
      idempotencyScope: "booking",
      idempotencyKey: "idem_1",
      evaluatedRisk: ["high", "critical"],
      status: ["succeeded", "denied"],
      reversalKind: ["domain_command", "compensate"],
      reversalState: ["available", "requested"],
      reversalOutcome: ["partial"],
      reversesActionId: "alge_original",
      reversedByActionId: "alge_reversal",
      sensitiveReasonCode: "travel_details_reveal",
      decisionPolicy: "bookings-pii-scope-or-staff-v1",
      occurredAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      occurredAtTo: new Date("2026-05-15T10:00:00.000Z"),
      cursor: {
        occurredAt: "2026-05-15T10:00:00.000Z",
        id: "alge_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "alge_1",
          occurredAt: "2026-05-15T10:00:00.000Z",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
      ],
      pageInfo: {
        nextCursor: {
          occurredAt: "2026-05-15T10:00:00.000Z",
          id: "alge_1",
        },
      },
    })
  })

  test("rejects cursor halves", () => {
    const parsed = __test__.actionLedgerEntryListQuerySchema.safeParse({
      cursorOccurredAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("lists relay outbox rows with health filters and cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listRelayOutbox").mockResolvedValue({
      rows: [makeRelayOutbox()],
      nextCursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "alro_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/relay-outbox?actionId=alge_1&organizationId=org_1&relayStatus=pending,failed&dueBefore=2026-05-15T10%3A05%3A00.000Z&createdAtFrom=2026-05-15T09%3A00%3A00.000Z&createdAtTo=2026-05-15T10%3A00%3A00.000Z&processedAtFrom=2026-05-15T10%3A15%3A00.000Z&processedAtTo=2026-05-15T10%3A30%3A00.000Z&cursorCreatedAt=2026-05-15T10%3A00%3A00.000Z&cursorId=alro_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      actionId: "alge_1",
      organizationId: "org_1",
      relayStatus: ["pending", "failed"],
      dueBefore: new Date("2026-05-15T10:05:00.000Z"),
      createdAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      createdAtTo: new Date("2026-05-15T10:00:00.000Z"),
      processedAtFrom: new Date("2026-05-15T10:15:00.000Z"),
      processedAtTo: new Date("2026-05-15T10:30:00.000Z"),
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "alro_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "alro_1",
          relayStatus: "pending",
          createdAt: "2026-05-15T10:00:00.000Z",
          nextRetryAt: "2026-05-15T10:05:00.000Z",
          processedAt: null,
        },
      ],
      pageInfo: {
        nextCursor: {
          createdAt: "2026-05-15T10:00:00.000Z",
          id: "alro_1",
        },
      },
    })
  })

  test("rejects relay outbox cursor halves", () => {
    const parsed = __test__.actionLedgerRelayOutboxListQuerySchema.safeParse({
      cursorCreatedAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("gets one entry with profile details", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue({
      entry: makeEntry({
        actionName: "booking.status.confirm",
        actionKind: "update",
        targetType: "booking",
        targetId: "book_1",
      }),
      mutationDetail: makeMutationDetail(),
      sensitiveReadDetail: makeSensitiveReadDetail(),
      payloads: [makePayload()],
      relayOutbox: [makeRelayOutbox()],
    })

    const app = makeApp(db)
    const response = await app.request("/entries/alge_1")

    expect(spy).toHaveBeenCalledWith(db, "alge_1")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "alge_1",
        occurredAt: "2026-05-15T10:00:00.000Z",
        createdAt: "2026-05-15T10:00:00.000Z",
        mutationDetail: {
          actionId: "alge_1",
          summary: "Booking status changed from on_hold to confirmed",
          reversalKind: "none",
        },
        sensitiveReadDetail: {
          actionId: "alge_1",
          reasonCode: "travel_details_reveal",
          disclosedFieldSet: ["passportNumber"],
        },
        payloads: [
          {
            id: "alpa_1",
            createdAt: "2026-05-15T10:00:00.000Z",
            expiresAt: "2026-06-15T10:00:00.000Z",
            storageRef: "blob://action-ledger/alge_1/input",
          },
        ],
        relayOutbox: [
          {
            id: "alro_1",
            relayStatus: "pending",
            createdAt: "2026-05-15T10:00:00.000Z",
            nextRetryAt: "2026-05-15T10:05:00.000Z",
            processedAt: null,
          },
        ],
      },
    })
  })

  test("returns 404 when an entry is missing", async () => {
    vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/entries/alge_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action ledger entry not found",
    })
  })
})
