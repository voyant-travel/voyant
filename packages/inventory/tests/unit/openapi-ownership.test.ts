import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

type OpenApiDocument = {
  paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>>
}

function readDocument(name: string): OpenApiDocument {
  return JSON.parse(
    readFileSync(new URL(`../../openapi/admin/${name}.json`, import.meta.url), "utf8"),
  ) as OpenApiDocument
}

describe("inventory extension OpenAPI ownership", () => {
  it("claims every inventory authoring operation", () => {
    const document = readDocument("inventory-authoring")
    const apiId = "@voyant-travel/inventory#authoring.extension.api"
    const operations = [
      document.paths["/v1/admin/products/compose"]?.post,
      document.paths["/v1/admin/products/{id}/duplicate"]?.post,
    ]

    expect(operations.every((operation) => operation?.["x-voyant-api-id"] === apiId)).toBe(true)
  })

  it("claims every booking product detail operation", () => {
    const document = readDocument("inventory-booking")
    const apiId = "@voyant-travel/inventory#booking-extension.api"
    const operations = [
      ...["get", "put", "delete"].map(
        (method) => document.paths["/v1/admin/bookings/{bookingId}/product-details"]?.[method],
      ),
      ...["get", "put", "delete"].map(
        (method) =>
          document.paths["/v1/admin/bookings/{bookingId}/items/{itemId}/product-details"]?.[method],
      ),
    ]

    expect(operations.every((operation) => operation?.["x-voyant-api-id"] === apiId)).toBe(true)
  })
})
