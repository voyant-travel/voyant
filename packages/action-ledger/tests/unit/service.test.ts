import type { AnyDrizzleDb } from "@voyantjs/db"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, test } from "vitest"
import type {
  ActionLedgerEntry,
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
  test("composes actor, token, target, workflow, correlation, risk, and status filters", () => {
    const predicate = __test__.buildActionLedgerEntriesPredicate({
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      apiTokenId: "key_1",
      sessionId: "sess_1",
      targetType: "booking_traveler",
      targetId: "bkpt_1",
      workflowRunId: "wf_run_1",
      workflowStepId: "wf_step_1",
      correlationId: "corr_1",
      evaluatedRisk: ["high", "critical"],
      status: ["succeeded", "denied"],
    })

    expect(predicate).toBeDefined()
    const query = new PgDialect().sqlToQuery(predicate!)

    expect(query.sql).toContain('"action_ledger_entries"."actor_type" = $1')
    expect(query.sql).toContain('"action_ledger_entries"."principal_type" = $2')
    expect(query.sql).toContain('"action_ledger_entries"."principal_id" = $3')
    expect(query.sql).toContain('"action_ledger_entries"."api_token_id" = $4')
    expect(query.sql).toContain('"action_ledger_entries"."session_id" = $5')
    expect(query.sql).toContain('"action_ledger_entries"."target_type" = $6')
    expect(query.sql).toContain('"action_ledger_entries"."target_id" = $7')
    expect(query.sql).toContain('"action_ledger_entries"."workflow_run_id" = $8')
    expect(query.sql).toContain('"action_ledger_entries"."workflow_step_id" = $9')
    expect(query.sql).toContain('"action_ledger_entries"."correlation_id" = $10')
    expect(query.sql).toContain('"action_ledger_entries"."evaluated_risk" in ($11, $12)')
    expect(query.sql).toContain('"action_ledger_entries"."status" in ($13, $14)')
    expect(query.params).toEqual([
      "staff",
      "user",
      "usr_1",
      "key_1",
      "sess_1",
      "booking_traveler",
      "bkpt_1",
      "wf_run_1",
      "wf_step_1",
      "corr_1",
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
    const { db, calls } = makeGetEntryDb({ entry, mutationDetail, sensitiveReadDetail })

    await expect(actionLedgerService.getEntry(db, entry.id)).resolves.toEqual({
      entry,
      mutationDetail,
      sensitiveReadDetail,
    })
    expect(calls).toEqual([
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
    ])
  })

  test("returns null when an entry is missing", async () => {
    const { db, calls } = makeGetEntryDb({})

    await expect(actionLedgerService.getEntry(db, "alge_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_ledger_entries"])
  })
})

describe("actionLedgerService.appendEntry", () => {
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

function makeGetEntryDb(input: {
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
}) {
  const calls: string[] = []
  const selectRows = [
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
  ]
  const callLabels = [
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
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

function makeAppendDb() {
  const entries: ActionLedgerEntry[] = []
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
        values(values: NewActionLedgerEntry) {
          return {
            returning() {
              const entry = makeEntry({
                ...values,
                id: `alge_${entries.length + 1}`,
                occurredAt: values.occurredAt ?? baseDate,
                createdAt: values.createdAt ?? baseDate,
                actorType: values.actorType ?? null,
                principalSubtype: values.principalSubtype ?? null,
                sessionId: values.sessionId ?? null,
                apiTokenId: values.apiTokenId ?? null,
                delegatedByPrincipalType: values.delegatedByPrincipalType ?? null,
                delegatedByPrincipalId: values.delegatedByPrincipalId ?? null,
                delegationId: values.delegationId ?? null,
                callerType: values.callerType ?? null,
                organizationId: values.organizationId ?? null,
                routeOrToolName: values.routeOrToolName ?? null,
                workflowRunId: values.workflowRunId ?? null,
                workflowStepId: values.workflowStepId ?? null,
                correlationId: values.correlationId ?? null,
                causationActionId: values.causationActionId ?? null,
                idempotencyScope: values.idempotencyScope ?? null,
                idempotencyKey: values.idempotencyKey ?? null,
                idempotencyFingerprint: values.idempotencyFingerprint ?? null,
                capabilityId: values.capabilityId ?? null,
                capabilityVersion: values.capabilityVersion ?? null,
                authorizationSource: values.authorizationSource ?? null,
                approvalId: values.approvalId ?? null,
                amendsActionId: values.amendsActionId ?? null,
              })
              entries.push(entry)
              return Promise.resolve([entry])
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, entries }
}
