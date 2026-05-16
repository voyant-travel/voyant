import type { AnyDrizzleDb } from "@voyantjs/db"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, test } from "vitest"
import type {
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionLedgerRelayOutbox,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
  NewActionLedgerEntry,
} from "../../src/schema.js"
import {
  __test__,
  ActionLedgerIdempotencyConflictError,
  type AppendActionLedgerEntryInput,
  actionLedgerService,
} from "../../src/service.js"

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
    correlationId: null,
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

describe("actionLedgerService.listEntries", () => {
  test("composes action, actor, target, workflow, control, risk, and status filters", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
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
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."action_name" = $1')
    expect(query.sql).toContain('"action_ledger_entries"."action_kind" = $2')
    expect(query.sql).toContain('"action_ledger_entries"."actor_type" = $3')
    expect(query.sql).toContain('"action_ledger_entries"."principal_type" = $4')
    expect(query.sql).toContain('"action_ledger_entries"."principal_id" = $5')
    expect(query.sql).toContain('"action_ledger_entries"."api_token_id" = $6')
    expect(query.sql).toContain('"action_ledger_entries"."session_id" = $7')
    expect(query.sql).toContain('"action_ledger_entries"."caller_type" = $8')
    expect(query.sql).toContain('"action_ledger_entries"."organization_id" = $9')
    expect(query.sql).toContain('"action_ledger_entries"."target_type" = $10')
    expect(query.sql).toContain('"action_ledger_entries"."target_id" = $11')
    expect(query.sql).toContain('"action_ledger_entries"."route_or_tool_name" = $12')
    expect(query.sql).toContain('"action_ledger_entries"."workflow_run_id" = $13')
    expect(query.sql).toContain('"action_ledger_entries"."workflow_step_id" = $14')
    expect(query.sql).toContain('"action_ledger_entries"."correlation_id" = $15')
    expect(query.sql).toContain('"action_ledger_entries"."causation_action_id" = $16')
    expect(query.sql).toContain('"action_ledger_entries"."capability_id" = $17')
    expect(query.sql).toContain('"action_ledger_entries"."capability_version" = $18')
    expect(query.sql).toContain('"action_ledger_entries"."authorization_source" = $19')
    expect(query.sql).toContain('"action_ledger_entries"."approval_id" = $20')
    expect(query.sql).toContain('"action_ledger_entries"."amends_action_id" = $21')
    expect(query.sql).toContain('"action_ledger_entries"."idempotency_scope" = $22')
    expect(query.sql).toContain('"action_ledger_entries"."idempotency_key" = $23')
    expect(query.sql).toContain('"action_ledger_entries"."evaluated_risk" in ($24, $25)')
    expect(query.sql).toContain('"action_ledger_entries"."status" in ($26, $27)')
    expect(query.params).toEqual([
      "booking.status.confirm",
      "update",
      "staff",
      "user",
      "usr_1",
      "key_1",
      "sess_1",
      "session",
      "org_1",
      "booking",
      "book_1",
      "bookings.confirm",
      "wf_run_1",
      "wf_step_1",
      "corr_1",
      "alge_parent",
      "bookings:status:confirm",
      "v1",
      "bookings.status.route",
      "appr_1",
      "alge_prior",
      "booking",
      "idem_1",
      "high",
      "critical",
      "succeeded",
      "denied",
    ])
  })

  test("uses occurred_at plus id as the cursor tie-breaker", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
      cursor: {
        occurredAt: "2026-05-15T10:00:00.000Z",
        id: "alge_cursor",
      },
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."occurred_at" < $1')
    expect(query.sql).toContain('"action_ledger_entries"."occurred_at" = $2')
    expect(query.sql).toContain('"action_ledger_entries"."id" < $3')
    expect(query.params).toEqual([
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "alge_cursor",
    ])
  })

  test("overfetches by one and returns the last visible row as the next cursor", async () => {
    const rows = [
      makeEntry({ id: "alge_3", occurredAt: new Date("2026-05-15T10:03:00.000Z") }),
      makeEntry({ id: "alge_2", occurredAt: new Date("2026-05-15T10:02:00.000Z") }),
      makeEntry({ id: "alge_1", occurredAt: new Date("2026-05-15T10:01:00.000Z") }),
    ]
    const { db, calls } = makeListDb(rows)

    const result = await actionLedgerService.listEntries(db, { limit: 2 })

    expect(result.entries.map((entry) => entry.id)).toEqual(["alge_3", "alge_2"])
    expect(result.nextCursor).toEqual({
      occurredAt: "2026-05-15T10:02:00.000Z",
      id: "alge_2",
    })
    expect(calls).toEqual([
      { phase: "orderBy", argCount: 2 },
      { phase: "limit", value: 3 },
    ])
  })
})

describe("actionLedgerService.listRelayOutbox", () => {
  test("composes relay status, action, organization, due, and cursor filters", () => {
    const predicate = __test__.buildActionLedgerRelayOutboxPredicate({
      actionId: "alge_1",
      organizationId: "org_1",
      relayStatus: ["pending", "failed"],
      dueBefore: "2026-05-15T10:05:00.000Z",
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "alro_cursor",
      },
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_outbox"."action_id" = $1')
    expect(query.sql).toContain('"action_ledger_outbox"."organization_id" = $2')
    expect(query.sql).toContain('"action_ledger_outbox"."relay_status" in ($3, $4)')
    expect(query.sql).toContain('"action_ledger_outbox"."next_retry_at" <= $5')
    expect(query.sql).toContain('"action_ledger_outbox"."created_at" < $6')
    expect(query.sql).toContain('"action_ledger_outbox"."created_at" = $7')
    expect(query.sql).toContain('"action_ledger_outbox"."id" < $8')
    expect(query.params).toEqual([
      "alge_1",
      "org_1",
      "pending",
      "failed",
      "2026-05-15T10:05:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "2026-05-15T10:00:00.000Z",
      "alro_cursor",
    ])
  })

  test("overfetches by one and returns the last visible relay row as the next cursor", async () => {
    const rows = [
      makeRelayOutbox({ id: "alro_3", createdAt: new Date("2026-05-15T10:03:00.000Z") }),
      makeRelayOutbox({ id: "alro_2", createdAt: new Date("2026-05-15T10:02:00.000Z") }),
      makeRelayOutbox({ id: "alro_1", createdAt: new Date("2026-05-15T10:01:00.000Z") }),
    ]
    const { db, calls } = makeRelayOutboxListDb(rows)

    const result = await actionLedgerService.listRelayOutbox(db, { limit: 2 })

    expect(result.rows.map((row) => row.id)).toEqual(["alro_3", "alro_2"])
    expect(result.nextCursor).toEqual({
      createdAt: "2026-05-15T10:02:00.000Z",
      id: "alro_2",
    })
    expect(calls).toEqual([
      { phase: "orderBy", argCount: 2 },
      { phase: "limit", value: 3 },
    ])
  })
})

describe("actionLedgerService.getEntry", () => {
  test("returns an entry with mutation and sensitive-read details", async () => {
    const entry = makeEntry({
      id: "alge_detail",
      actionName: "booking.status.confirm",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
    })
    const mutationDetail = makeMutationDetail({ actionId: entry.id })
    const sensitiveReadDetail = makeSensitiveReadDetail({ actionId: entry.id })
    const payload = makePayload({ actionId: entry.id })
    const relayOutbox = makeRelayOutbox({ actionId: entry.id })
    const { db, calls } = makeGetEntryDb({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })

    await expect(actionLedgerService.getEntry(db, entry.id)).resolves.toEqual({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })
    expect(calls).toEqual([
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
      "action_ledger_outbox",
    ])
  })

  test("returns null when an entry is missing", async () => {
    const { db, calls } = makeGetEntryDb({})

    await expect(actionLedgerService.getEntry(db, "alge_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_ledger_entries"])
  })
})

describe("actionLedgerService.appendEntry", () => {
  test("inserts payload references and relay markers with the action id", async () => {
    const { db, insertedPayloads, insertedRelayOutbox } = makeAppendDb()

    const result = await actionLedgerService.appendEntry(db, {
      actionName: "booking.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "high",
      principalType: "user",
      principalId: "usr_1",
      internalRequest: false,
      organizationId: "org_1",
      targetType: "booking",
      targetId: "book_1",
      payloads: [
        {
          payloadKind: "command_input",
          schemaTag: "booking.cancel:v1",
          retentionPolicy: "audit-default",
          storageRef: "blob://action-ledger/book_1/cancel-input",
          hash: "sha256:payload",
        },
      ],
      enqueueRelay: { payloadRef: "blob://action-ledger/book_1" },
    })

    expect(result.replayed).toBe(false)
    expect(insertedPayloads).toEqual([
      expect.objectContaining({
        actionId: result.entry.id,
        payloadKind: "command_input",
        schemaTag: "booking.cancel:v1",
        retentionPolicy: "audit-default",
        storageRef: "blob://action-ledger/book_1/cancel-input",
        hash: "sha256:payload",
      }),
    ])
    expect(insertedRelayOutbox).toEqual([
      expect.objectContaining({
        actionId: result.entry.id,
        organizationId: "org_1",
        payloadRef: "blob://action-ledger/book_1",
        relayStatus: "pending",
      }),
    ])
  })

  test("throws a conflict when an idempotency key is replayed with a different fingerprint", async () => {
    const { db } = makeAppendDb()
    const input: AppendActionLedgerEntryInput = {
      actionName: "booking.cancel",
      actionVersion: "v1",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "medium",
      principalType: "user",
      principalId: "usr_1",
      internalRequest: false,
      targetType: "booking",
      targetId: "book_1",
      idempotencyScope: "booking",
      idempotencyKey: "idem_1",
      idempotencyFingerprint: "sha256:first",
    }

    await actionLedgerService.appendEntry(db, input)

    await expect(
      actionLedgerService.appendEntry(db, {
        ...input,
        idempotencyFingerprint: "sha256:second",
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: "alge_1",
    })
  })
})

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
    expiresAt: null,
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
    nextRetryAt: null,
    lastError: null,
    createdAt: baseDate,
    processedAt: null,
    ...overrides,
  }
}

function makeGetEntryDb(input: {
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
  relayOutbox?: ActionLedgerRelayOutbox[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
    input.relayOutbox ?? [],
  ]
  const callLabels = [
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
    "action_ledger_outbox",
  ]
  let selectIndex = 0

  const db = {
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          return {
            where() {
              if (index >= 3) {
                calls.push(callLabels[index] ?? `select_${index}`)
                return Promise.resolve(selectRows[index] ?? [])
              }

              return {
                limit() {
                  calls.push(callLabels[index] ?? `select_${index}`)
                  return Promise.resolve(selectRows[index] ?? [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeListDb(rows: ActionLedgerEntry[]) {
  const calls: Array<{ phase: string; argCount?: number; value?: number }> = []
  let limit = rows.length
  const query = {
    where() {
      calls.push({ phase: "where" })
      return query
    },
    orderBy(...args: unknown[]) {
      calls.push({ phase: "orderBy", argCount: args.length })
      return query
    },
    limit(value: number) {
      calls.push({ phase: "limit", value })
      limit = value
      return Promise.resolve(rows.slice(0, limit))
    },
  }

  const db = {
    select() {
      return {
        from() {
          return {
            $dynamic() {
              return query
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeRelayOutboxListDb(rows: ActionLedgerRelayOutbox[]) {
  const calls: Array<{ phase: string; argCount?: number; value?: number }> = []
  let limit = rows.length
  const query = {
    where() {
      calls.push({ phase: "where" })
      return query
    },
    orderBy(...args: unknown[]) {
      calls.push({ phase: "orderBy", argCount: args.length })
      return query
    },
    limit(value: number) {
      calls.push({ phase: "limit", value })
      limit = value
      return Promise.resolve(rows.slice(0, limit))
    },
  }

  const db = {
    select() {
      return {
        from() {
          return {
            $dynamic() {
              return query
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, calls }
}

function makeAppendDb() {
  const entries: ActionLedgerEntry[] = []
  const insertedMutationDetails: unknown[] = []
  const insertedPayloads: unknown[] = []
  const insertedRelayOutbox: unknown[] = []
  const insertedSensitiveReadDetails: unknown[] = []
  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(entries.slice(0, 1))
                },
              }
            },
          }
        },
      }
    },
    insert() {
      return {
        values(values: NewActionLedgerEntry | Record<string, unknown> | Record<string, unknown>[]) {
          if (Array.isArray(values)) {
            insertedPayloads.push(...values)
            return {}
          }

          if ("payloadKind" in values) {
            insertedPayloads.push(values)
            return {}
          }

          if ("relayStatus" in values) {
            insertedRelayOutbox.push(values)
            return {}
          }

          if ("reasonCode" in values || "disclosedFieldSet" in values) {
            insertedSensitiveReadDetails.push(values)
            return {}
          }

          if ("summary" in values || "reversalKind" in values) {
            insertedMutationDetails.push(values)
            return {}
          }

          return {
            returning() {
              const entryValues = values as NewActionLedgerEntry
              const entry = makeEntry({
                ...entryValues,
                id: `alge_${entries.length + 1}`,
                occurredAt: entryValues.occurredAt ?? baseDate,
                createdAt: entryValues.createdAt ?? baseDate,
                actorType: entryValues.actorType ?? null,
                principalSubtype: entryValues.principalSubtype ?? null,
                sessionId: entryValues.sessionId ?? null,
                apiTokenId: entryValues.apiTokenId ?? null,
                delegatedByPrincipalType: entryValues.delegatedByPrincipalType ?? null,
                delegatedByPrincipalId: entryValues.delegatedByPrincipalId ?? null,
                delegationId: entryValues.delegationId ?? null,
                callerType: entryValues.callerType ?? null,
                organizationId: entryValues.organizationId ?? null,
                routeOrToolName: entryValues.routeOrToolName ?? null,
                workflowRunId: entryValues.workflowRunId ?? null,
                workflowStepId: entryValues.workflowStepId ?? null,
                correlationId: entryValues.correlationId ?? null,
                causationActionId: entryValues.causationActionId ?? null,
                idempotencyScope: entryValues.idempotencyScope ?? null,
                idempotencyKey: entryValues.idempotencyKey ?? null,
                idempotencyFingerprint: entryValues.idempotencyFingerprint ?? null,
                capabilityId: entryValues.capabilityId ?? null,
                capabilityVersion: entryValues.capabilityVersion ?? null,
                authorizationSource: entryValues.authorizationSource ?? null,
                approvalId: entryValues.approvalId ?? null,
                amendsActionId: entryValues.amendsActionId ?? null,
              })
              entries.push(entry)
              return Promise.resolve([entry])
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return {
    db,
    entries,
    insertedMutationDetails,
    insertedPayloads,
    insertedRelayOutbox,
    insertedSensitiveReadDetails,
  }
}
