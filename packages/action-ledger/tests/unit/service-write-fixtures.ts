import type { AnyDrizzleDb } from "@voyant-travel/db"
import type {
  ActionApproval,
  ActionLedgerEntry,
  NewActionApproval,
  NewActionLedgerEntry,
} from "../../src/schema.js"
import { actionApprovals, actionLedgerEntries } from "../../src/schema.js"
import { baseDate, makeApproval, makeEntry } from "./service-fixtures.js"

export function makeApprovalLifecycleDb(
  input: { entries?: ActionLedgerEntry[]; approvals?: ActionApproval[] } = {},
) {
  const entries = [...(input.entries ?? [])]
  const approvals = [...(input.approvals ?? [])]
  const insertedMutationDetails: unknown[] = []
  const insertedPayloads: unknown[] = []
  const insertedSensitiveReadDetails: unknown[] = []
  const transactionCalls: string[] = []

  const db = {
    transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      transactionCalls.push("transaction")
      return callback(db as AnyDrizzleDb)
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === actionApprovals) {
                    return Promise.resolve(approvals.slice(0, 1))
                  }
                  if (table === actionLedgerEntries) {
                    return Promise.resolve(entries.slice(0, 1))
                  }
                  return Promise.resolve([])
                },
              }
            },
          }
        },
      }
    },
    insert(table: unknown) {
      return {
        values(values: NewActionLedgerEntry | NewActionApproval | Record<string, unknown>[]) {
          if (Array.isArray(values)) {
            insertedPayloads.push(...values)
            return {}
          }

          if ("payloadKind" in values) {
            insertedPayloads.push(values)
            return {}
          }

          if ("reasonCode" in values && table !== actionApprovals) {
            insertedSensitiveReadDetails.push(values)
            return {}
          }

          if ("summary" in values || "reversalKind" in values) {
            insertedMutationDetails.push(values)
            return {}
          }

          return {
            returning() {
              if (table === actionApprovals) {
                const approvalValues = values as NewActionApproval
                const approval = makeApproval({
                  ...approvalValues,
                  id: approvalValues.id ?? `appr_${approvals.length + 1}`,
                  decidedAt: approvalValues.decidedAt ?? null,
                  decidedByPrincipalId: approvalValues.decidedByPrincipalId ?? null,
                  delegatedFromPrincipalId: approvalValues.delegatedFromPrincipalId ?? null,
                  assignedToPrincipalId: approvalValues.assignedToPrincipalId ?? null,
                  targetSnapshotRef: approvalValues.targetSnapshotRef ?? null,
                  reasonCode: approvalValues.reasonCode ?? null,
                  expiresAt: approvalValues.expiresAt ?? null,
                  createdAt: approvalValues.createdAt ?? baseDate,
                })
                approvals.push(approval)
                return Promise.resolve([approval])
              }

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
        set(values: Partial<ActionApproval>) {
          return {
            where() {
              return {
                returning() {
                  if (table !== actionApprovals) return Promise.resolve([])
                  const approval = approvals.find((row) => row.status === "pending")
                  if (!approval) return Promise.resolve([])
                  Object.assign(approval, values)
                  return Promise.resolve([approval])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return {
    db,
    entries,
    approvals,
    insertedMutationDetails,
    insertedPayloads,
    insertedSensitiveReadDetails,
    transactionCalls,
  }
}

export function makeAppendDb() {
  const entries: ActionLedgerEntry[] = []
  const insertedMutationDetails: unknown[] = []
  const insertedPayloads: unknown[] = []
  const insertedSensitiveReadDetails: unknown[] = []
  const transactionCalls: string[] = []
  const db = {
    async transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      transactionCalls.push("begin")
      try {
        const result = await callback(db as AnyDrizzleDb)
        transactionCalls.push("commit")
        return result
      } catch (error) {
        transactionCalls.push("rollback")
        throw error
      }
    },
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
    insertedSensitiveReadDetails,
    transactionCalls,
  }
}
