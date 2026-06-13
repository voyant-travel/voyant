import { sql } from "drizzle-orm"
import { Hono } from "hono"
import { beforeAll, beforeEach } from "vitest"

import { relationshipsRoutes } from "../../src/routes/index.js"

export const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

export const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export const jsonWithIdempotency = (body: Record<string, unknown>, key: string) => ({
  headers: { "Content-Type": "application/json", "Idempotency-Key": key },
  body: JSON.stringify(body),
})

export function setupAccountRoutesTest() {
  let app: Hono

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    const db = createTestDb()
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "unaccent"`)
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", relationshipsRoutes)
  })

  beforeEach(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(createTestDb())
  })

  return () => app
}
