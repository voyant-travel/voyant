import { listResponse, listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"
import { publicCatalogTagSchema } from "./routes-public.js"
import type { publicProductsService } from "./service-public.js"

/**
 * Response contract test (voyant#2114): the storefront `GET /v1/public/products/tags`
 * route's declared OpenAPI response schema must match what `listCatalogTags`
 * returns. The fixture is typed as the service's row element, so a column change
 * breaks compilation; the JSON round-trip validates the wire shape against the
 * declared schema.
 */
type TagRow = Awaited<ReturnType<typeof publicProductsService.listCatalogTags>>["data"][number]

const row: TagRow = { id: "ptag_0000000000000000000000", name: "Adventure" }

describe("public catalog tags response contract", () => {
  it("the serialized wire response satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([row], { total: 1, limit: 100, offset: 0 })),
    )
    const parsed = listResponseSchema(publicCatalogTagSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
