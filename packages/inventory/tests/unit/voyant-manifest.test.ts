import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import {
  createInventoryBrochureVoyantRuntime,
  createInventoryContentVoyantRuntime,
  createInventoryVoyantRuntime,
} from "../../src/graph-runtime.js"
import { createProductBrochureHonoExtension } from "../../src/routes-brochure.js"
import { createProductContentHonoExtension } from "../../src/routes-content.js"
import {
  inventoryAuthoringVoyantPlugin,
  inventoryBookingVoyantPlugin,
  inventoryBrochureVoyantPlugin,
  inventoryContentVoyantPlugin,
  inventoryExtrasVoyantModule,
  inventoryVoyantModule,
} from "../../src/voyant.js"
import {
  createProductsGeneratePdfWorkflow,
  productsGeneratePdfWorkflow,
} from "../../src/workflow-entry.js"

describe("inventory deployment manifests", () => {
  it("owns the inventory and extras module surfaces", () => {
    expect(inventoryVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/inventory",
      packageName: "@voyant-travel/inventory",
      api: [
        {
          id: "@voyant-travel/inventory#api.admin",
          surface: "admin",
          openapi: { document: "products" },
          runtime: {
            entry: "@voyant-travel/inventory/graph-runtime",
            export: "createInventoryVoyantRuntime",
          },
        },
        {
          id: "@voyant-travel/inventory#api.public",
          surface: "public",
          openapi: { document: "products" },
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/inventory/graph-runtime",
            export: "createInventoryVoyantRuntime",
          },
        },
      ],
      runtimePorts: [{ id: "inventory.runtime" }],
      schema: [{ id: "@voyant-travel/inventory#schema" }],
      migrations: [{ id: "@voyant-travel/inventory#migrations" }],
      links: [
        { id: "@voyant-travel/inventory#linkable.product" },
        { id: "@voyant-travel/inventory#link.organization-product" },
        { id: "@voyant-travel/inventory#link.person-product" },
      ],
      workflows: [
        {
          id: "products.generate-pdf",
          source: "@voyant-travel/inventory/workflows",
          runtime: {
            entry: "@voyant-travel/inventory/workflows",
            export: "productsGeneratePdfWorkflow",
          },
        },
      ],
    })

    expect(inventoryExtrasVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/inventory#extras",
      api: [
        {
          id: "@voyant-travel/inventory#extras.api",
          openapi: { document: "extras" },
          runtime: {
            entry: "@voyant-travel/inventory/graph-runtime",
            export: "createInventoryExtrasVoyantRuntime",
          },
        },
      ],
    })
  })

  it("owns the authoring and booking plugin surfaces", () => {
    expect(inventoryAuthoringVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#authoring.extension",
      api: [
        {
          id: "@voyant-travel/inventory#authoring.extension.api",
          transactional: true,
          runtime: {
            entry: "@voyant-travel/inventory/authoring/extension",
            export: "inventoryAuthoringExtension",
          },
        },
      ],
    })

    expect(inventoryBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#booking-extension",
      api: [
        {
          id: "@voyant-travel/inventory#booking-extension.api",
          runtime: {
            entry: "@voyant-travel/inventory/booking-extension",
            export: "productsBookingExtension",
          },
        },
      ],
    })
  })

  it("owns the split content and brochure extensions", () => {
    expect(inventoryContentVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#content-extension",
      api: [
        {
          surface: "admin",
          mount: "products",
          openapi: { document: "products" },
          runtime: { export: "createInventoryContentVoyantRuntime" },
        },
        {
          surface: "public",
          mount: "products",
          openapi: { document: "products" },
          anonymous: true,
          runtime: { export: "createInventoryContentVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "catalog.content-runtime" }],
    })
    expect(inventoryBrochureVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#brochure-extension",
      api: [
        {
          surface: "admin",
          mount: "products",
          openapi: { document: "products" },
          runtime: { export: "createInventoryBrochureVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "inventory.brochure-runtime" }],
    })

    const resolveRegistry = () => ({}) as never
    const content = createProductContentHonoExtension({
      admin: { resolveRegistry, defaultAcceptMachineTranslated: false },
      public: { resolveRegistry, defaultAcceptMachineTranslated: true },
    })
    const brochure = createProductBrochureHonoExtension({ resolveStorage: () => null })
    expect(content.extension).toMatchObject({ name: "content", module: "products" })
    expect(content.adminRoutes).toBeDefined()
    expect(content.publicRoutes).toBeDefined()
    expect(brochure.extension).toMatchObject({ name: "brochure", module: "products" })
    expect(isGraphRuntimeFactory(createInventoryVoyantRuntime)).toBe(true)
    expect(isGraphRuntimeFactory(createInventoryContentVoyantRuntime)).toBe(true)
    expect(isGraphRuntimeFactory(createInventoryBrochureVoyantRuntime)).toBe(true)
  })

  it("exposes a configurable PDF workflow factory", () => {
    const definition = createProductsGeneratePdfWorkflow({ resolveDb: () => ({}) as never })
    expect(definition.id).toBe("products.generate-pdf")
    expect(definition.config.defaultRuntime).toBe("node")
  })

  it("exports the declared executable PDF workflow", () => {
    expect(productsGeneratePdfWorkflow.id).toBe(inventoryVoyantModule.workflows?.[0]?.id)
    expect(inventoryVoyantModule.workflows?.[0]?.runtime).toEqual({
      entry: "@voyant-travel/inventory/workflows",
      export: "productsGeneratePdfWorkflow",
    })
  })
})
