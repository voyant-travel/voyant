import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { expect } from "vitest"

import { sourceConnections } from "../../src/schema.js"

export function createMemorySourceConnectionsDb(): PostgresJsDatabase {
  const rows: Array<Record<string, unknown>> = []
  let seq = 0

  function nextId() {
    seq += 1
    return `srce_test_${seq}`
  }

  const db = {
    insert(table: unknown) {
      expect(table).toBe(sourceConnections)
      return {
        values(value: Record<string, unknown>) {
          const now = new Date()
          const row = {
            id: value.id ?? nextId(),
            credentialRef: null,
            credentialRefVersion: null,
            sourceAccountId: null,
            grantedScopes: [],
            capabilities: [],
            status: "draft",
            healthStatus: "unknown",
            lastCheckedAt: null,
            lastHealthyAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            retryAfterAt: null,
            rateLimitState: null,
            cursorState: null,
            disconnectBehavior: [],
            disconnectReason: null,
            disconnectRequestedAt: null,
            disconnectedAt: null,
            metadata: null,
            createdAt: now,
            updatedAt: now,
            ...value,
          }
          rows.push(row)
          return {
            returning() {
              return [row]
            },
          }
        },
      }
    },
    update(table: unknown) {
      expect(table).toBe(sourceConnections)
      return {
        set(patch: Record<string, unknown>) {
          return {
            where() {
              return {
                returning() {
                  const row = rows[0]
                  if (!row) return []
                  Object.assign(row, patch)
                  return [row]
                },
              }
            },
          }
        },
      }
    },
    select(selection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          expect(table).toBe(sourceConnections)
          return makeQuery(rows, selection)
        },
      }
    },
  }

  return db as PostgresJsDatabase
}

function makeQuery(rows: Array<Record<string, unknown>>, selection?: Record<string, unknown>) {
  let limitValue: number | undefined
  const query = {
    where() {
      if (selection && "count" in selection) return [{ count: rows.length }]
      return query
    },
    orderBy() {
      return query
    },
    limit(value: number) {
      limitValue = value
      return withOffset(materializeRows(rows, selection, limitValue, 0), (offsetValue) =>
        materializeRows(rows, selection, limitValue, offsetValue),
      )
    },
  }
  return query
}

function materializeRows(
  rows: Array<Record<string, unknown>>,
  selection: Record<string, unknown> | undefined,
  limitValue: number | undefined,
  offsetValue: number,
): Array<Record<string, unknown>> {
  if (selection && "count" in selection) return [{ count: rows.length }]
  const end = limitValue === undefined ? undefined : offsetValue + limitValue
  return rows.slice(offsetValue, end)
}

function withOffset<T>(rows: T[], factory: (offset: number) => T[]) {
  return Object.assign(rows, {
    offset(offset: number) {
      return factory(offset)
    },
    orderBy() {
      return rows
    },
  })
}
