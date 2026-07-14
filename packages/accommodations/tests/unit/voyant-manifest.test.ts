import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import { createAccommodationsContentVoyantRuntime } from "../../src/graph-runtime.js"
import {
  ACCOMMODATION_CONTENT_OPENAPI_API_IDS,
  createAccommodationContentHonoExtension,
} from "../../src/routes-content.js"
import { accommodationsContentVoyantPlugin, accommodationsVoyantModule } from "../../src/voyant.js"

describe("accommodations deployment manifest", () => {
  it("owns its runtime, schema, migrations, and linkable", () => {
    expect(accommodationsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/accommodations",
      packageName: "@voyant-travel/accommodations",
      api: [
        {
          id: "@voyant-travel/accommodations#api",
          surface: "admin",
          mount: "accommodations",
          transactional: true,
          openapi: { document: "accommodations" },
          runtime: {
            entry: "@voyant-travel/accommodations",
            export: "accommodationsHonoModule",
          },
        },
      ],
      schema: [
        {
          id: "@voyant-travel/accommodations#schema",
          source: "@voyant-travel/accommodations/schema",
        },
      ],
      migrations: [{ id: "@voyant-travel/accommodations#migrations", source: "./migrations" }],
      links: [
        {
          id: "@voyant-travel/accommodations#linkable.roomBlock",
          source: "@voyant-travel/accommodations/linkables",
        },
        { id: "@voyant-travel/accommodations#link.program-room-block" },
        { id: "@voyant-travel/accommodations#link.room-block-property" },
        { id: "@voyant-travel/accommodations#link.room-block-supplier" },
      ],
    })
  })

  it("owns its catalog content extension", () => {
    expect(accommodationsContentVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/accommodations#content-extension",
      api: [
        {
          surface: "admin",
          mount: "accommodations",
          openapi: { document: "accommodations" },
          runtime: { export: "createAccommodationsContentVoyantRuntime" },
        },
        {
          surface: "public",
          mount: "accommodations",
          anonymous: true,
          openapi: { document: "accommodations-content-public" },
          runtime: { export: "createAccommodationsContentVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "catalog.content-runtime" }],
    })

    const resolveRegistry = () => ({}) as never
    const extension = createAccommodationContentHonoExtension({
      admin: { resolveRegistry, defaultAcceptMachineTranslated: false },
      public: { resolveRegistry, defaultAcceptMachineTranslated: true },
    })
    expect(extension.extension).toMatchObject({ name: "content", module: "accommodations" })
    expect(extension.adminRoutes).toBeDefined()
    expect(extension.publicRoutes).toBeDefined()
    expect(isGraphRuntimeFactory(createAccommodationsContentVoyantRuntime)).toBe(true)
    const document = openApiDocument(extension.publicRoutes)
    expect(readApiId(document, "/{id}/content", "get")).toBe(
      ACCOMMODATION_CONTENT_OPENAPI_API_IDS.public,
    )
  })

  it("describes access to the accommodations API mount", () => {
    expect(accommodationsVoyantModule.access?.resources).toEqual([
      expect.objectContaining({
        resource: "accommodations",
        label: "Accommodations",
        description: expect.any(String),
        actions: [
          expect.objectContaining({
            action: "read",
            label: expect.any(String),
            description: expect.any(String),
          }),
          expect.objectContaining({
            action: "write",
            label: expect.any(String),
            description: expect.any(String),
          }),
        ],
      }),
    ])
  })
})

function openApiDocument(routes: unknown) {
  return (routes as OpenApiDocumentSource).getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Accommodation content", version: "1" },
  })
}

interface OpenApiDocumentSource {
  getOpenAPI31Document(input: { openapi: "3.1.0"; info: { title: string; version: string } }): {
    paths?: Record<string, Record<string, unknown>>
  }
}

function readApiId(
  document: { paths?: Record<string, Record<string, unknown>> },
  path: string,
  method: string,
) {
  return (document.paths?.[path]?.[method] as Record<string, unknown> | undefined)?.[
    "x-voyant-api-id"
  ]
}
