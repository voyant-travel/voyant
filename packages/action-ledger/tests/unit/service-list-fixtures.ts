import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ActionApproval, ActionDelegation, ActionLedgerEntry } from "../../src/schema.js"

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
