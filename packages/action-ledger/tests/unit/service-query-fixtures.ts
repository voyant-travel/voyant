import type { AnyDrizzleDb } from "@voyant-travel/db"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerPayload,
  ActionMutationDetail,
  ActionSensitiveReadDetail,
  NewActionLedgerEntry,
} from "../../src/schema.js"
import { actionMutationDetails } from "../../src/schema.js"
import { baseDate, makeEntry } from "./service-fixtures.js"

export function makeGetEntryDb(input: {
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
  ]
  const callLabels = [
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
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

export function makeReversalDb(input: {
  entry: ActionLedgerEntry
  mutationDetail: ActionMutationDetail
}) {
  const entries = [input.entry]
  const insertedMutationDetails: unknown[] = []
  const updatedMutationDetails: unknown[] = []
  const selectRows = [[input.entry], [input.mutationDetail], [], []]
  let selectIndex = 0

  const db = {
    transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      return callback(db as AnyDrizzleDb)
    },
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          return {
            where() {
              if (index >= 3) {
                return Promise.resolve(selectRows[index] ?? [])
              }
              return {
                limit() {
                  return Promise.resolve(selectRows[index] ?? [])
                },
              }
            },
          }
        },
      }
    },
    insert(table: unknown) {
      return {
        values(values: NewActionLedgerEntry | Record<string, unknown>) {
          if (table === actionMutationDetails) {
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
    update(table: unknown) {
      return {
        set(values: unknown) {
          if (table === actionMutationDetails) {
            updatedMutationDetails.push(values)
          }
          return {
            where() {
              return Promise.resolve([])
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, entries, insertedMutationDetails, updatedMutationDetails }
}

export function makeGetApprovalDb(input: {
  approval?: ActionApproval
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.approval ? [input.approval] : [],
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
  ]
  const callLabels = [
    "action_approvals",
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
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
              if (index >= 4) {
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

export function makeValidateApprovedActionDb(input: {
  approval?: ActionApproval
  entry?: ActionLedgerEntry
  mutationDetail?: ActionMutationDetail
  sensitiveReadDetail?: ActionSensitiveReadDetail
  payloads?: ActionLedgerPayload[]
  existingExecutions?: ActionLedgerEntry[]
}) {
  const calls: string[] = []
  const selectRows = [
    input.approval ? [input.approval] : [],
    input.entry ? [input.entry] : [],
    input.mutationDetail ? [input.mutationDetail] : [],
    input.sensitiveReadDetail ? [input.sensitiveReadDetail] : [],
    input.payloads ?? [],
  ]
  const callLabels = [
    "action_approvals",
    "action_ledger_entries",
    "action_mutation_details",
    "action_sensitive_read_details",
    "action_ledger_payloads",
  ]
  let selectIndex = 0

  const listQuery = {
    where() {
      return listQuery
    },
    orderBy() {
      return listQuery
    },
    limit() {
      calls.push("action_ledger_entries:list")
      return Promise.resolve(input.existingExecutions ?? [])
    },
  }

  const db = {
    select() {
      const index = selectIndex
      selectIndex += 1
      return {
        from() {
          if (index >= selectRows.length) {
            return {
              $dynamic() {
                return listQuery
              },
            }
          }

          return {
            where() {
              if (index >= 4) {
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

export function makeGetDelegationDb(row: ActionDelegation | null) {
  const calls: string[] = []
  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  calls.push("action_delegations")
                  return Promise.resolve(row ? [row] : [])
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
