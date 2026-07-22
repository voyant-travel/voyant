import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { productMedia } from "../../src/schema.js"
import { catalogProductsService } from "../../src/service-catalog.js"

// Minimal awaitable query-builder stub: every builder method chains and the
// final await resolves to an empty result set, so hydration runs against a
// product row with no relations.
function createStubDb(rowsByTable = new Map<unknown, unknown[]>()): PostgresJsDatabase {
  const db = {
    select: () => ({
      from: (table: unknown) => createBuilder(rowsByTable.get(table) ?? []),
    }),
  }
  return db as PostgresJsDatabase
}

function createBuilder(rows: unknown[]): Record<string, unknown> {
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
  builder.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve)
  return builder
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

  it("excludes day media from product cover and Open Graph fallbacks", async () => {
    const dayImage = {
      id: "pmed_day_cover",
      productId: makeProductRow().id,
      dayId: "day_1",
      mediaType: "image",
      name: "Day cover",
      url: "https://example.com/day.jpg",
      mimeType: "image/jpeg",
      width: 1200,
      height: 630,
      altText: "Day image",
      sortOrder: 0,
      isCover: true,
      isOpenGraph: false,
      isBrochure: false,
      isBrochureCurrent: false,
      brochureVersion: null,
    }
    const productImage = {
      ...dayImage,
      id: "pmed_product",
      dayId: null,
      name: "Product image",
      url: "https://example.com/product.jpg",
      altText: "Product image",
      sortOrder: 1,
      isCover: false,
    }
    const db = createStubDb(new Map([[productMedia, [dayImage, productImage]]]))

    const [product] = await catalogProductsService.hydrateProducts(db, [makeProductRow()], {
      includeContent: true,
    })

    expect(product?.coverMedia?.url).toBe(productImage.url)
    expect(product?.openGraphImage?.url).toBe(productImage.url)
    expect(product?.media.map((item) => item.url)).toEqual([dayImage.url, productImage.url])
  })
})
