import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import {
  CHARTERS_BOOKING_OPENAPI_API_ID,
  chartersBookingExtensionRoutes,
} from "../../src/booking-extension.js"
import { createChartersHonoModule, createChartersVoyantRuntime } from "../../src/index.js"
import { CHARTERS_PUBLIC_OPENAPI_API_ID } from "../../src/routes-openapi.js"
import { chartersPublicRoutes } from "../../src/routes-public.js"
import { chartersBookingVoyantPlugin, chartersVoyantModule } from "../../src/voyant.js"

describe("charters deployment manifest", () => {
  it("owns its transactional operator and anonymous storefront surfaces", () => {
    expect(chartersVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/charters",
      packageName: "@voyant-travel/charters",
      api: [
        {
          surface: "admin",
          mount: "charters",
          transactional: true,
          openapi: { document: "charters" },
          runtime: { export: "createChartersVoyantRuntime" },
        },
        {
          surface: "public",
          mount: "charters",
          anonymous: true,
          transactional: true,
          openapi: { document: "charters" },
          runtime: { export: "createChartersVoyantRuntime" },
        },
      ],
      schema: [{ id: "@voyant-travel/charters#schema", source: "@voyant-travel/charters/schema" }],
      migrations: [{ id: "@voyant-travel/charters#migrations", source: "./migrations" }],
      links: [
        { id: "@voyant-travel/charters#linkable.charter_product" },
        { id: "@voyant-travel/charters#linkable.charter_voyage" },
        { id: "@voyant-travel/charters#linkable.charter_yacht" },
      ],
    })
    expect(isGraphRuntimeFactory(createChartersVoyantRuntime)).toBe(true)
    expect(readApiIds(chartersPublicRoutes)).toEqual(
      Array.from({ length: 7 }, () => CHARTERS_PUBLIC_OPENAPI_API_ID),
    )
  })

  it("owns the bookings extension and preserves injected lazy bridges", () => {
    expect(chartersBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/charters#booking-extension",
      api: [
        {
          surface: "admin",
          mount: "bookings",
          openapi: { document: "bookings" },
          runtime: { export: "chartersBookingExtension" },
        },
      ],
    })

    const lazyAdminRoutes = async () => ({}) as never
    const lazyPublicRoutes = async () => ({}) as never
    const module = createChartersHonoModule({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module).toMatchObject({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module.adminRoutes).toBeUndefined()
    expect(module.publicRoutes).toBeUndefined()

    expect(readApiIds(chartersBookingExtensionRoutes)).toEqual([
      CHARTERS_BOOKING_OPENAPI_API_ID,
      CHARTERS_BOOKING_OPENAPI_API_ID,
      CHARTERS_BOOKING_OPENAPI_API_ID,
      CHARTERS_BOOKING_OPENAPI_API_ID,
      CHARTERS_BOOKING_OPENAPI_API_ID,
    ])
  })
})

function readApiIds(routes: OpenApiDocumentSource): unknown[] {
  const document = routes.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Charter booking extension", version: "1" },
  })
  return Object.values(document.paths ?? {}).flatMap((path) =>
    Object.values(path).map((operation) => operation["x-voyant-api-id"]),
  )
}

interface OpenApiDocumentSource {
  getOpenAPI31Document(input: { openapi: "3.1.0"; info: { title: string; version: string } }): {
    paths?: Record<string, Record<string, Record<string, unknown>>>
  }
}
