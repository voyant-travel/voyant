import { describe, expect, it } from "vitest"
import {
  catalogBookingEngineVoyantModule,
  catalogOffersVoyantPlugin,
  catalogVoyantModule,
} from "../../src/voyant.js"

describe("catalog deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(catalogVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/catalog",
      packageName: "@voyant-travel/catalog",
      api: [
        {
          id: "@voyant-travel/catalog#api.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/catalog",
            export: "createCatalogSearchHonoModule",
          },
        },
        {
          id: "@voyant-travel/catalog#api.public",
          surface: "public",
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/catalog",
            export: "createCatalogSearchHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/catalog#schema" }],
      migrations: [{ id: "@voyant-travel/catalog#migrations" }],
    })
  })

  it("owns the booking engine and offers bridge declarations", () => {
    expect(catalogBookingEngineVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/catalog#booking-engine",
      packageName: "@voyant-travel/catalog",
      api: [
        {
          id: "@voyant-travel/catalog#booking-engine.api.admin",
          surface: "admin",
          mount: "catalog",
          runtime: {
            entry: "@voyant-travel/catalog/booking-engine",
            export: "createCatalogBookingEngineHonoModule",
          },
        },
        {
          id: "@voyant-travel/catalog#booking-engine.api.public",
          surface: "public",
          mount: "catalog",
          runtime: {
            entry: "@voyant-travel/catalog/booking-engine",
            export: "createCatalogBookingEngineHonoModule",
          },
        },
      ],
    })

    expect(catalogOffersVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.plugin.v1",
      id: "@voyant-travel/catalog#offers-extension",
      packageName: "@voyant-travel/catalog",
      api: [
        {
          id: "@voyant-travel/catalog#offers-extension.api",
          surface: "admin",
          mount: "catalog",
          runtime: {
            entry: "@voyant-travel/catalog/offers",
            export: "createCatalogOffersHonoExtension",
          },
        },
      ],
    })
  })
})
