import { actionLedgerInventoryDriftRuntimePort } from "@voyant-travel/action-ledger/runtime-port"
import { bookingsInventoryRuntimePort } from "@voyant-travel/bookings/runtime-port"
import { catalogInventoryRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { commerceInventoryRuntimePort } from "@voyant-travel/commerce/runtime-port"
import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { financeInventoryPaymentPolicyRuntimePort } from "@voyant-travel/finance/runtime-port"
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
      provides: {
        capabilities: ["inventory.data-owner"],
        ports: [
          { id: catalogInventoryRuntimeExtensionPort.id },
          { id: commerceInventoryRuntimePort.id },
          { id: actionLedgerInventoryDriftRuntimePort.id },
          { id: bookingsInventoryRuntimePort.id },
          { id: financeInventoryPaymentPolicyRuntimePort.id },
          { id: "inventory.runtime" },
        ],
      },
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
    expectConcreteEventSchemas(inventoryVoyantModule.events)

    expect(inventoryExtrasVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/inventory#extras",
      requires: { capabilities: ["inventory.data-owner"] },
      api: [
        {
          id: "@voyant-travel/inventory#extras.api",
          resource: "extras",
          openapi: { document: "extras" },
          runtime: {
            entry: "@voyant-travel/inventory/graph-runtime",
            export: "createInventoryExtrasVoyantRuntime",
          },
        },
      ],
      access: {
        resources: [expect.objectContaining({ resource: "extras" })],
      },
    })
  })

  it("declares product navigation and route scopes", () => {
    expect(
      inventoryVoyantModule.admin?.routes?.every((route) =>
        route.requiredScopes?.includes("products:read"),
      ),
    ).toBe(true)
    expect(inventoryVoyantModule.admin?.nav).toEqual([
      expect.objectContaining({
        routeId: "@voyant-travel/inventory#admin.route.products-index",
        label: { namespace: "inventory.admin", key: "productsPage.title" },
      }),
    ])
  })

  it("binds product authoring and lifecycle Tools to governed actions", () => {
    expect(inventoryVoyantModule.tools?.map(({ name }) => name)).toEqual([
      "list_products",
      "get_product",
      "create_product",
      "update_product",
      "publish_product",
      "unpublish_product",
      "archive_product",
    ])
    expect(inventoryVoyantModule.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "@voyant-travel/inventory#action.create-product",
          ledger: "required",
          approval: "never",
          allowedActorTypes: ["staff"],
        }),
        expect.objectContaining({
          id: "@voyant-travel/inventory#action.publish-product",
          risk: "high",
          ledger: "required",
          approval: "required",
          allowedActorTypes: ["staff"],
        }),
      ]),
    )
  })

  it("owns the authoring and booking plugin surfaces", () => {
    expect(inventoryAuthoringVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#authoring.extension",
      api: [
        {
          id: "@voyant-travel/inventory#authoring.extension.api",
          openapi: { document: "inventory-authoring" },
          transactional: true,
          runtime: {
            entry: "@voyant-travel/inventory/authoring/extension",
            export: "inventoryAuthoringExtension",
          },
        },
      ],
      tools: [
        expect.objectContaining({
          id: "@voyant-travel/inventory#authoring.tool.compose-product",
          name: "compose_product",
          risk: "high",
        }),
      ],
      actions: [
        expect.objectContaining({
          id: "@voyant-travel/inventory#authoring.action.compose-product",
          ledger: "required",
          reversible: true,
        }),
      ],
    })

    expect(inventoryBookingVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#booking-extension",
      api: [
        {
          id: "@voyant-travel/inventory#booking-extension.api",
          openapi: { document: "inventory-booking" },
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
      tools: [
        expect.objectContaining({
          id: "@voyant-travel/inventory#content-extension.tool.get-product-content",
          name: "get_product_content",
          context: ["inventoryContent"],
        }),
      ],
      actions: [
        expect.objectContaining({
          id: "@voyant-travel/inventory#content-extension.action.get-product-content",
          ledger: "optional",
        }),
      ],
    })
    expect(inventoryBrochureVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/inventory#brochure-extension",
      provides: { ports: [{ id: "inventory.brochure-runtime" }] },
      api: [
        {
          surface: "admin",
          mount: "products",
          openapi: { document: "products" },
          runtime: { export: "createInventoryBrochureVoyantRuntime" },
        },
      ],
      runtimePorts: [{ id: "inventory.brochure-runtime" }, { id: "storage.media-runtime" }],
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

function expectConcreteEventSchemas(events: readonly { payloadSchema: unknown }[]) {
  for (const event of events) {
    expect(event.payloadSchema).toEqual(
      expect.objectContaining({
        type: "object",
        required: expect.any(Array),
        properties: expect.any(Object),
      }),
    )
  }
}
