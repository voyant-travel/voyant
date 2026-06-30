import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { productRoutes } from "../../src/routes.js"
import {
  productCategories,
  products,
  productTags,
  productTranslations,
  productTypes,
} from "../../src/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

type DuplicateErrorBody = {
  error: string
  code: string
  details: {
    resource: string
    fields: Record<string, string[]>
    issues: Array<{ code: string; path: string[]; message: string }>
  }
}

describe.skipIf(!DB_AVAILABLE)("inventory duplicate create errors", () => {
  const db = createTestDb()
  let app: Hono

  beforeAll(async () => {
    app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", productRoutes)
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  async function expectDuplicateError(
    res: Response,
    expected: {
      code: string
      message: string
      resource: string
      fields: string[]
    },
  ) {
    expect(res.status).toBe(409)
    const body = (await res.json()) as DuplicateErrorBody

    expect(body.error).toBe(expected.message)
    expect(body.code).toBe(expected.code)
    expect(body.details.resource).toBe(expected.resource)
    expect(body.details.fields).toEqual(
      Object.fromEntries(expected.fields.map((field) => [field, [expected.message]])),
    )
    expect(body.details.issues).toEqual(
      expected.fields.map((field) => ({
        code: expected.code,
        path: [field],
        message: expected.message,
      })),
    )
  }

  it("returns field context for duplicate product type code", async () => {
    await db.insert(productTypes).values({ name: "Walking Tour", code: "walking-tour" })

    const res = await app.request("/product-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "City Walk", code: "walking-tour" }),
    })

    await expectDuplicateError(res, {
      code: "duplicate_product_type_code",
      message: "Product type code already exists",
      resource: "product_type",
      fields: ["code"],
    })
  })

  it("returns field context for duplicate product category slug", async () => {
    await db.insert(productCategories).values({ name: "City Tours", slug: "city-tours" })

    const res = await app.request("/product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Urban Tours", slug: "city-tours" }),
    })

    await expectDuplicateError(res, {
      code: "duplicate_product_category_slug",
      message: "Product category slug already exists",
      resource: "product_category",
      fields: ["slug"],
    })
  })

  it("returns field context for duplicate product tag name", async () => {
    await db.insert(productTags).values({ name: "Family friendly" })

    const res = await app.request("/product-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Family friendly" }),
    })

    await expectDuplicateError(res, {
      code: "duplicate_product_tag_name",
      message: "Product tag name already exists",
      resource: "product_tag",
      fields: ["name"],
    })
  })

  it("returns field context for duplicate product translation locale", async () => {
    const [product] = await db
      .insert(products)
      .values({ name: "Croatia Tour", sellCurrency: "EUR" })
      .returning({ id: products.id })

    if (!product) throw new Error("Failed to seed product")

    await db.insert(productTranslations).values({
      productId: product.id,
      languageTag: "en",
      name: "Croatia Tour",
    })

    const res = await app.request(`/${product.id}/translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageTag: "en", name: "Croatia Tour Duplicate" }),
    })

    await expectDuplicateError(res, {
      code: "duplicate_product_translation_language",
      message: "Product translation already exists for this product and language",
      resource: "product_translation",
      fields: ["productId", "languageTag"],
    })
  })
})
