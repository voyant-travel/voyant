import { describe, expect, it } from "vitest"
import {
  inventoryAuthoringVoyantPlugin,
  inventoryBookingVoyantPlugin,
  inventoryExtrasVoyantModule,
  inventoryVoyantModule,
} from "../../src/voyant.js"

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
          runtime: { entry: "@voyant-travel/inventory", export: "inventoryHonoModule" },
        },
        {
          id: "@voyant-travel/inventory#api.public",
          surface: "public",
          runtime: { entry: "@voyant-travel/inventory", export: "inventoryHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/inventory#schema" }],
      migrations: [{ id: "@voyant-travel/inventory#migrations" }],
      links: [{ id: "@voyant-travel/inventory#linkable.product" }],
    })

    expect(inventoryExtrasVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/inventory#extras",
      api: [
        {
          id: "@voyant-travel/inventory#extras.api",
          runtime: {
            entry: "@voyant-travel/inventory/extras",
            export: "inventoryExtrasHonoModule",
          },
        },
      ],
    })
  })

  it("owns the authoring and booking plugin surfaces", () => {
    expect(inventoryAuthoringVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
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
      schemaVersion: "voyant.plugin.v1",
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
})
