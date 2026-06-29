import type { AnyDrizzleDb } from "@voyant-travel/db"
import type {
  ActionApproval,
  ActionDelegation,
  ActionLedgerEntry,
  ActionLedgerRelayOutbox,
} from "../../src/schema.js"

export function makeListDb(rows: ActionLedgerEntry[]) {
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

export function makeRelayOutboxListDb(rows: ActionLedgerRelayOutbox[]) {
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

export function makeApprovalListDb(rows: ActionApproval[]) {
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

export function makeDelegationListDb(rows: ActionDelegation[]) {
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

function makeRelayOutboxSqlRow(row: ActionLedgerRelayOutbox) {
  return {
    id: row.id,
    action_id: row.actionId,
    organization_id: row.organizationId,
    relay_status: row.relayStatus,
    payload_ref: row.payloadRef,
    attempt_count: row.attemptCount,
    next_retry_at: row.nextRetryAt,
    last_error: row.lastError,
    created_at: row.createdAt,
    processed_at: row.processedAt,
  }
}

export function makeRelayOutboxClaimDb(rows: ActionLedgerRelayOutbox[]) {
  const queries: unknown[] = []
  const db = {
    execute(query: unknown) {
      queries.push(query)
      return Promise.resolve({ rows: rows.map(makeRelayOutboxSqlRow) })
    },
  } as AnyDrizzleDb

  return { db, queries }
}

export function makeRelayOutboxUpdateDb(row: ActionLedgerRelayOutbox | null) {
  const patches: unknown[] = []
  const db = {
    update() {
      return {
        set(values: unknown) {
          patches.push(values)
          return {
            where() {
              return {
                returning() {
                  return Promise.resolve(row ? [row] : [])
                },
              }
            },
          }
        },
      }
    },
  } as AnyDrizzleDb

  return { db, patches }
}
