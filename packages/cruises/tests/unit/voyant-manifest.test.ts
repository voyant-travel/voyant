import { assertPortConforms, isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import {
  CRUISES_BOOKING_OPENAPI_API_ID,
  cruisesBookingExtensionRoutes,
} from "../../src/booking-extension.js"
import { createCruisesContentVoyantRuntime } from "../../src/graph-runtime.js"
import { createCruisesHonoModule, createCruisesVoyantRuntime } from "../../src/index.js"
import {
  CRUISE_CONTENT_OPENAPI_API_IDS,
  createCruiseContentHonoExtension,
} from "../../src/routes-content.js"
import { cruisesRoutesRuntimePort } from "../../src/runtime-port.js"
import {
  cruisesBookingVoyantPlugin,
  cruisesContentVoyantPlugin,
  cruisesVoyantModule,
} from "../../src/voyant.js"

describe("cruises deployment manifest", () => {
  it("owns its transactional operator and anonymous storefront surfaces", () => {
    expect(cruisesVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/cruises",
      packageName: "@voyant-travel/cruises",
      api: [
        {
          surface: "admin",
          mount: "cruises",
          transactional: true,
          openapi: { document: "cruises" },
          runtime: { export: "createCruisesVoyantRuntime" },
        },
        {
          surface: "public",
          mount: "cruises",
          anonymous: true,
          transactional: true,
          openapi: { document: "cruises" },
          runtime: { export: "createCruisesVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "cruises.routes-runtime" }],
      schema: [{ id: "@voyant-travel/cruises#schema", source: "@voyant-travel/cruises/schema" }],
      migrations: [{ id: "@voyant-travel/cruises#migrations", source: "./migrations" }],
      links: [
        { id: "@voyant-travel/cruises#linkable.cruise" },
        { id: "@voyant-travel/cruises#linkable.cruise_voyage_group" },
        { id: "@voyant-travel/cruises#linkable.cruise_sailing" },
        { id: "@voyant-travel/cruises#linkable.cruise_ship" },
      ],
      workflows: [
        expect.objectContaining({
          id: "cruises.external-catalog-refresh",
          schedules: [expect.objectContaining({ id: "external-cruise-catalog-refresh" })],
          runtime: {
            entry: "@voyant-travel/cruises/external-refresh-workflow",
            export: "cruisesExternalCatalogRefreshWorkflow",
          },
        }),
      ],
    })
    expect(isGraphRuntimeFactory(createCruisesVoyantRuntime)).toBe(true)
  })

  it("validates the deployment registry contract", async () => {
    await expect(
      assertPortConforms(cruisesRoutesRuntimePort, {
        resolveSourceAdapterRegistry: async () => ({}) as never,
      }),
    ).resolves.toBeUndefined()
    await expect(assertPortConforms(cruisesRoutesRuntimePort, {} as never)).rejects.toThrow(
      /resolveSourceAdapterRegistry/,
    )
  })

  it("owns content and booking extensions", () => {
    expect(cruisesContentVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/cruises#content-extension",
      api: [
        {
          surface: "admin",
          mount: "cruises",
          openapi: { document: "cruises" },
          runtime: { export: "createCruisesContentVoyantRuntime" },
        },
        {
          surface: "public",
          mount: "cruises",
          openapi: { document: "cruises" },
          runtime: { export: "createCruisesContentVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "catalog.content-runtime" }],
    })
    expect(cruisesBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/cruises#booking-extension",
      api: [
        {
          surface: "admin",
          mount: "bookings",
          openapi: { document: "bookings" },
          runtime: { export: "cruisesBookingExtension" },
        },
      ],
    })

    const resolveRegistry = () => ({}) as never
    const extension = createCruiseContentHonoExtension({
      admin: { resolveRegistry, defaultAcceptMachineTranslated: false, allowOwnedKeys: true },
      public: { resolveRegistry, defaultAcceptMachineTranslated: true, allowOwnedKeys: true },
    })
    expect(extension.extension).toMatchObject({ name: "content", module: "cruises" })
    expect(extension.adminRoutes).toBeDefined()
    expect(extension.publicRoutes).toBeDefined()
    expect(isGraphRuntimeFactory(createCruisesContentVoyantRuntime)).toBe(true)
    expect(new Set(readApiIds(extension.adminRoutes as OpenApiDocumentSource))).toEqual(
      new Set([CRUISE_CONTENT_OPENAPI_API_IDS.admin]),
    )
    expect(new Set(readApiIds(extension.publicRoutes as OpenApiDocumentSource))).toEqual(
      new Set([CRUISE_CONTENT_OPENAPI_API_IDS.public]),
    )
    expect(readApiIds(cruisesBookingExtensionRoutes)).toEqual(
      Array.from({ length: 6 }, () => CRUISES_BOOKING_OPENAPI_API_ID),
    )
  })

  it("preserves deployment-injected lazy route bridges", () => {
    const lazyAdminRoutes = async () => ({}) as never
    const lazyPublicRoutes = async () => ({}) as never
    const module = createCruisesHonoModule({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module).toMatchObject({ lazyAdminRoutes, lazyPublicRoutes, anonymous: true })
    expect(module.adminRoutes).toBeUndefined()
    expect(module.publicRoutes).toBeUndefined()
  })
})

function readApiIds(routes: OpenApiDocumentSource): unknown[] {
  const document = routes.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Cruises", version: "1" },
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
