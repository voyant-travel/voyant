import { listResponse, listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"
import { publicCatalogCategorySchema, publicCatalogDestinationSchema } from "./routes-public.js"
import type { publicProductsService } from "./service-public.js"

/**
 * Response contract tests (voyant#2114): the storefront `/v1/public/products/categories`
 * and `/destinations` routes' declared OpenAPI response schemas must match what
 * `listCatalogCategories` / `listCatalogDestinations` return. Fixtures are typed
 * as the service's row element, so a shape change breaks compilation; the JSON
 * round-trip validates the wire payload against the declared schema.
 */
type CategoryRow = Awaited<
  ReturnType<typeof publicProductsService.listCatalogCategories>
>["data"][number]
type DestinationRow = Awaited<
  ReturnType<typeof publicProductsService.listCatalogDestinations>
>["data"][number]

const categoryRow: CategoryRow = {
  id: "pcat_0000000000000000000000",
  parentId: null,
  name: "Tours",
  slug: "tours",
  description: null,
  sortOrder: 0,
}

const destinationRow: DestinationRow = {
  id: "dest_0000000000000000000000",
  parentId: null,
  slug: "paris",
  canonicalPlaceId: null,
  name: "Paris",
  description: null,
  seoTitle: null,
  seoDescription: null,
  destinationType: "destination",
  latitude: 48.8566,
  longitude: 2.3522,
  sortOrder: 0,
}

describe("public catalog taxonomy response contracts", () => {
  it("categories: serialized wire response satisfies the declared schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([categoryRow], { total: 1, limit: 100, offset: 0 })),
    )
    const parsed = listResponseSchema(publicCatalogCategorySchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("destinations: serialized wire response satisfies the declared schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([destinationRow], { total: 1, limit: 100, offset: 0 })),
    )
    const parsed = listResponseSchema(publicCatalogDestinationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
