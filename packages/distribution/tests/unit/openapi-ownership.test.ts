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

describe("distribution extension OpenAPI ownership", () => {
  it("claims the booking distribution detail operations", () => {
    const document = readDocument("distribution-booking")
    const operations = document.paths["/v1/admin/bookings/{bookingId}/distribution-details"]
    const apiId = "@voyant-travel/distribution#extension.api"

    expect(
      [operations?.get, operations?.put, operations?.delete].every(
        (operation) => operation?.["x-voyant-api-id"] === apiId,
      ),
    ).toBe(true)
  })

  it("claims every channel push operation", () => {
    const document = readDocument("distribution-channel-push")
    const apiId = "@voyant-travel/distribution#channel-push-extension.api"
    const operations = [
      document.paths["/v1/admin/distribution/links"]?.get,
      document.paths["/v1/admin/distribution/retry/{bookingId}"]?.post,
      document.paths["/v1/admin/distribution/deliveries"]?.get,
      document.paths["/v1/admin/distribution/throttling"]?.get,
      document.paths["/v1/admin/distribution/reconcile/{flow}"]?.post,
    ]

    expect(operations.every((operation) => operation?.["x-voyant-api-id"] === apiId)).toBe(true)
  })
})
