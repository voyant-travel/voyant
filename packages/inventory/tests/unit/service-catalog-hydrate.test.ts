import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { catalogProductsService } from "../../src/service-catalog.js"

// Minimal awaitable query-builder stub: every builder method chains and the
// final await resolves to an empty result set, so hydration runs against a
// product row with no relations.
function createStubDb(): PostgresJsDatabase {
  const builder: Record<string, unknown> = {}
  const methods = [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "offset",
    "innerJoin",
    "leftJoin",
    "groupBy",
  ]
  for (const method of methods) {
    builder[method] = () => builder
  }
  // biome-ignore lint/suspicious/noThenProperty: reason: the stub must be thenable to mimic drizzle's awaitable query builder.
  builder.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve)
  return builder as PostgresJsDatabase
}

const LONG_DESCRIPTION = "d".repeat(800)

function makeProductRow() {
  return {
    id: "prod_01j00000000000000000000000",
    name: "Alpine Express",
    description: LONG_DESCRIPTION,
    inclusionsHtml: "<ul><li>All meals</li></ul>",
    exclusionsHtml: "<ul><li>Flights</li></ul>",
    termsHtml: "<p>Non-refundable</p>",
    bookingMode: "date",
    capacityMode: "limited",
    visibility: "public",
    sellCurrency: "EUR",
    sellAmountCents: 129900,
    startDate: null,
    endDate: null,
    pax: null,
    contractTemplateId: null,
    productTypeId: null,
  } as never
}

describe("catalogProductsService.hydrateProducts — summary content trim", () => {
  it("omits richtext content fields on the summary (list) shape by default", async () => {
    const [product] = await catalogProductsService.hydrateProducts(createStubDb(), [
      makeProductRow(),
    ])

    expect(product).toBeDefined()
    expect(product?.inclusionsHtml).toBeNull()
    expect(product?.exclusionsHtml).toBeNull()
    expect(product?.termsHtml).toBeNull()
    // Long-form description is capped on list payloads.
    expect(product?.description).toBe(LONG_DESCRIPTION.slice(0, 500))
    // Detail-only collections are not attached on the summary shape.
    expect(product && "media" in product).toBe(false)
    expect(product && "features" in product).toBe(false)
    expect(product && "faqs" in product).toBe(false)
  })

  it("keeps the full content when includeContent is set (detail / opt-in path)", async () => {
    const [product] = await catalogProductsService.hydrateProducts(
      createStubDb(),
      [makeProductRow()],
      { includeContent: true },
    )

    expect(product).toBeDefined()
    expect(product?.inclusionsHtml).toBe("<ul><li>All meals</li></ul>")
    expect(product?.exclusionsHtml).toBe("<ul><li>Flights</li></ul>")
    expect(product?.termsHtml).toBe("<p>Non-refundable</p>")
    expect(product?.description).toBe(LONG_DESCRIPTION)
    expect(product && "media" in product).toBe(true)
  })
})
