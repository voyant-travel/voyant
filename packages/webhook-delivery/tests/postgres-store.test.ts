import { PgDialect } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import { createPostgresWebhookDeliveryStore } from "../src/postgres-store.js"

describe("generic webhook Postgres claim scoping", () => {
  it("selects and claims only subscription target rows", async () => {
    const conditions: unknown[] = []
    const selectChain = {
      from: () => selectChain,
      where(condition: unknown) {
        conditions.push(condition)
        return selectChain
      },
      orderBy: () => selectChain,
      limit: async () => [],
    }
    const updateChain = {
      set: () => updateChain,
      where(condition: unknown) {
        conditions.push(condition)
        return updateChain
      },
      returning: async () => [],
    }
    const db = {
      select: () => selectChain,
      update: () => updateChain,
    } as never as PostgresJsDatabase
    const store = createPostgresWebhookDeliveryStore(db)
    const now = new Date("2026-07-23T10:00:00.000Z")

    await store.listReadyAttemptIds(now, new Date(now.getTime() - 60_000), 10)
    await store.claimAttempt("whd_missing", now, new Date(now.getTime() - 60_000))

    const dialect = new PgDialect()
    for (const condition of conditions) {
      const query = dialect.sqlToQuery(condition as never)
      expect(query.sql).toContain('"target_kind" =')
      expect(query.params).toContain("subscription")
      expect(query.params).not.toContain("app")
    }
  })
})
