import { type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { productRoutes } from "../../src/routes.js"
import { productMedia, products } from "../../src/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function ensureBrochureColumns(db: PostgresJsDatabase) {
  const statements: SQL[] = [
    sql`ALTER TABLE product_media ADD COLUMN IF NOT EXISTS is_brochure_current boolean DEFAULT false NOT NULL`,
    sql`ALTER TABLE product_media ADD COLUMN IF NOT EXISTS brochure_version integer`,
  ]

  for (const statement of statements) {
    await db.execute(statement)
  }
}

describe.skipIf(!DB_AVAILABLE)("Product brochure routes", () => {
  let app: Hono
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await ensureBrochureColumns(db)
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", productRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  it("lists brochure versions and can promote an older version", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Arctic Escape",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [v1, v2] = await db
      .insert(productMedia)
      .values([
        {
          productId: product.id,
          mediaType: "document",
          name: "Arctic Escape v1",
          url: "https://example.com/arctic-v1.pdf",
          mimeType: "application/pdf",
          isBrochure: true,
          isBrochureCurrent: false,
          brochureVersion: 1,
        },
        {
          productId: product.id,
          mediaType: "document",
          name: "Arctic Escape v2",
          url: "https://example.com/arctic-v2.pdf",
          mimeType: "application/pdf",
          isBrochure: true,
          isBrochureCurrent: true,
          brochureVersion: 2,
        },
      ])
      .returning()

    const listRes = await app.request(`/${product.id}/brochure/versions`, { method: "GET" })
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data).toHaveLength(2)
    expect(listBody.data[0]?.id).toBe(v2.id)

    const setCurrentRes = await app.request(
      `/${product.id}/brochure/versions/${v1.id}/set-current`,
      {
        method: "POST",
      },
    )
    expect(setCurrentRes.status).toBe(200)

    const currentRes = await app.request(`/${product.id}/brochure`, { method: "GET" })
    expect(currentRes.status).toBe(200)
    const currentBody = await currentRes.json()
    expect(currentBody.data.id).toBe(v1.id)
    expect(currentBody.data.isBrochureCurrent).toBe(true)
  })
})
