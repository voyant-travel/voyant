import { readFile } from "node:fs/promises"
import {
  VOYANT_EVENT_CATALOG_SCHEMA_VERSION,
  type VoyantGraphEventCatalog,
} from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"

import { createEventCatalogHonoApp } from "../src/routes.js"
import { eventCatalogVoyantModule } from "../src/voyant.js"

const catalog: VoyantGraphEventCatalog = {
  schemaVersion: VOYANT_EVENT_CATALOG_SCHEMA_VERSION,
  events: [
    {
      key: "booking.confirmed@1.0.0",
      id: "@voyant-travel/bookings#event.booking.confirmed",
      unitId: "@voyant-travel/bookings",
      packageName: "@voyant-travel/bookings",
      eventType: "booking.confirmed",
      version: "1.0.0",
      payloadSchema: {
        type: "object",
        properties: { bookingId: { type: "string" } },
        required: ["bookingId"],
        additionalProperties: false,
      },
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
      redactedFields: [],
    },
  ],
}

describe("event catalog package", () => {
  it("owns its graph-backed API, access resource, and admin docs contribution", () => {
    expect(eventCatalogVoyantModule).toMatchObject({
      id: "@voyant-travel/event-catalog",
      api: [
        {
          id: "@voyant-travel/event-catalog#api.admin",
          surface: "admin",
          mount: "event-catalog",
          resource: "event-catalog",
          openapi: { document: "event-catalog" },
        },
      ],
      access: {
        resources: [
          expect.objectContaining({
            resource: "event-catalog",
            actions: [expect.objectContaining({ action: "read" })],
          }),
        ],
      },
      admin: {
        routes: [
          expect.objectContaining({
            path: "/docs/events",
            requiredScopes: ["event-catalog:read"],
          }),
        ],
        nav: [
          expect.objectContaining({ routeId: "@voyant-travel/event-catalog#admin.route.docs" }),
        ],
      },
    })
  })

  it("returns the selected catalog without rebuilding or filtering it", async () => {
    const response = await createEventCatalogHonoApp(catalog).request("/")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: catalog })
  })

  it("documents the package-owned graph API id", () => {
    const document = createEventCatalogHonoApp(catalog).getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Event catalog", version: "1" },
    })

    expect(document.paths?.["/"]?.get?.["x-voyant-api-id"]).toBe(
      "@voyant-travel/event-catalog#api.admin",
    )
  })

  it("publishes the selected API operation in its committed OpenAPI artifact", async () => {
    const document = JSON.parse(
      await readFile(new URL("../openapi/admin/event-catalog.json", import.meta.url), "utf8"),
    )

    expect(document.paths["/v1/admin/event-catalog"].get["x-voyant-api-id"]).toBe(
      "@voyant-travel/event-catalog#api.admin",
    )
  })
})
