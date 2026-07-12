import { OpenAPIHono } from "@hono/zod-openapi"
import { describe, expect, it } from "vitest"

import { distributionBookingExtension } from "../../src/booking-extension.js"
import { createChannelPushAdminRoutes } from "../../src/channel-push/admin-routes.js"

function operations(app: OpenAPIHono) {
  const document = app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Distribution test", version: "1.0.0" },
  })
  return Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
    Object.entries(pathItem ?? {})
      .filter(([method]) => ["get", "post", "put", "delete"].includes(method))
      .map(([method, operation]) => ({ path, method, operation })),
  )
}

describe("Distribution OpenAPI runtime ownership", () => {
  it("owns booking-extension operations with the manifest API id", () => {
    const app = new OpenAPIHono()
    app.route("/bookings", distributionBookingExtension.adminRoutes)

    const authored = operations(app)
    expect(authored.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "get /bookings/{bookingId}/distribution-details",
      "put /bookings/{bookingId}/distribution-details",
      "delete /bookings/{bookingId}/distribution-details",
    ])
    expect(
      authored.every(
        ({ operation }) =>
          operation?.["x-voyant-api-id"] === "@voyant-travel/distribution#extension.api",
      ),
    ).toBe(true)
  })

  it("owns channel-push operations with the manifest API id", () => {
    const authored = operations(createChannelPushAdminRoutes())
    expect(authored.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "get /links",
      "post /retry/{bookingId}",
      "get /deliveries",
      "get /throttling",
      "post /reconcile/{flow}",
    ])
    expect(
      authored.every(
        ({ operation }) =>
          operation?.["x-voyant-api-id"] ===
          "@voyant-travel/distribution#channel-push-extension.api",
      ),
    ).toBe(true)
  })
})
