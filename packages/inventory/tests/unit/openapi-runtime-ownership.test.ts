import type { OpenAPIHono } from "@hono/zod-openapi"
import { describe, expect, it } from "vitest"

import { inventoryAuthoringRoutes } from "../../src/authoring/extension.js"
import { bookingProductExtensionRoutes } from "../../src/booking-extension.js"

type OpenApiOperation = { "x-voyant-api-id"?: string }

function operations(routes: OpenAPIHono): Map<string, OpenApiOperation> {
  const document = routes.getOpenAPIDocument({ info: { title: "test", version: "1" } })
  const result = new Map<string, OpenApiOperation>()

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of ["get", "put", "post", "delete"] as const) {
      const operation = pathItem?.[method]
      if (operation) result.set(`${method.toUpperCase()} ${path}`, operation)
    }
  }

  return result
}

describe("inventory extension OpenAPI runtime ownership", () => {
  it("claims the committed inventory authoring operations", () => {
    const live = operations(inventoryAuthoringRoutes)
    const apiId = "@voyant-travel/inventory#authoring.extension.api"

    expect([...live.keys()]).toEqual(["POST /compose", "POST /{id}/duplicate"])
    expect([...live.values()].every((operation) => operation["x-voyant-api-id"] === apiId)).toBe(
      true,
    )
  })

  it("claims the committed booking product-detail operations", () => {
    const live = operations(bookingProductExtensionRoutes)
    const apiId = "@voyant-travel/inventory#booking-extension.api"

    expect([...live.keys()]).toEqual([
      "GET /{bookingId}/product-details",
      "PUT /{bookingId}/product-details",
      "DELETE /{bookingId}/product-details",
      "GET /{bookingId}/items/{itemId}/product-details",
      "PUT /{bookingId}/items/{itemId}/product-details",
      "DELETE /{bookingId}/items/{itemId}/product-details",
    ])
    expect([...live.values()].every((operation) => operation["x-voyant-api-id"] === apiId)).toBe(
      true,
    )
  })
})
