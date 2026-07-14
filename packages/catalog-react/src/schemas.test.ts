import { describe, expect, it } from "vitest"

import { catalogSearchResponseSchema } from "./schemas.js"

describe("catalogSearchResponseSchema", () => {
  it("accepts and preserves a next cursor", () => {
    const result = catalogSearchResponseSchema.parse({
      vertical: "products",
      mode: "keyword",
      total: 1,
      next_cursor: "cursor-page-2",
      hits: [
        {
          id: "product-1",
          score: 1,
          document: { id: "product-1", fields: { name: "Product one" } },
        },
      ],
      facets: {},
    })

    expect(result.next_cursor).toBe("cursor-page-2")
  })
})
