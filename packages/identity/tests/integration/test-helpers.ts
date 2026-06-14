import { newId } from "@voyant-travel/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach } from "vitest"

import { identityRoutes } from "../../src/routes.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
export let DB_AVAILABLE = false

if (TEST_DATABASE_URL) {
  try {
    const testDb = createTestDb()
    await testDb.execute(/* sql */ `SELECT 1`)
    DB_AVAILABLE = true
  } catch {
    DB_AVAILABLE = false
  }
}

export const ENTITY_TYPE = "supplier"
export const ENTITY_ID = "supp_test123"
export const ENTITY_TYPE_2 = "person"
export const ENTITY_ID_2 = "pers_test456"

export { newId }

export function createIdentityTestContext() {
  let db!: PostgresJsDatabase
  let app!: Hono

  function createApp() {
    const hono = new Hono()
    hono.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user")
      await next()
    })
    hono.route("/v1/identity", identityRoutes)
    return hono
  }

  beforeAll(async () => {
    db = createTestDb()
  })

  afterAll(async () => {
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
    app = createApp()
  })

  return {
    req(method: string, path: string, body?: unknown) {
      const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
      if (body) init.body = JSON.stringify(body)
      return app.request(`/v1/identity${path}`, init)
    },
  }
}
