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
          transactional: ["/book", "/holds", "/orders", "/quote", "/quotes/batch"],
          runtime: {
            entry: "@voyant-travel/catalog/booking-engine",
            export: "createCatalogBookingEngineHonoModule",
          },
        },
        {
          id: "@voyant-travel/catalog#booking-engine.api.public",
          surface: "public",
          mount: "catalog",
          transactional: ["/book", "/holds", "/quote", "/quotes/batch"],
          runtime: {
            entry: "@voyant-travel/catalog/booking-engine",
            export: "createCatalogBookingEngineHonoModule",
          },
        },
      ],
    })

    expect(catalogOffersVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
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

  it("declares every route in the packaged catalog admin extension", () => {
    expect(catalogVoyantModule.admin?.routes?.map(({ id, path }) => [id, path])).toEqual([
      ["@voyant-travel/catalog#admin.route.index", "/catalog"],
      ["@voyant-travel/catalog#admin.route.products-index", "/catalog/products"],
      ["@voyant-travel/catalog#admin.route.products-detail", "/catalog/products/$productId"],
      ["@voyant-travel/catalog#admin.route.excursions-index", "/catalog/excursions"],
      ["@voyant-travel/catalog#admin.route.excursions-detail", "/catalog/excursions/$id"],
      ["@voyant-travel/catalog#admin.route.tours-index", "/catalog/tours"],
      ["@voyant-travel/catalog#admin.route.tours-detail", "/catalog/tours/$id"],
      ["@voyant-travel/catalog#admin.route.cruises-index", "/catalog/cruises"],
      ["@voyant-travel/catalog#admin.route.cruises-detail", "/catalog/cruises/$id"],
      ["@voyant-travel/catalog#admin.route.accommodations-index", "/catalog/accommodations"],
      ["@voyant-travel/catalog#admin.route.accommodations-detail", "/catalog/accommodations/$id"],
    ])
    expect(new Set(catalogVoyantModule.admin?.routes?.map(({ runtime }) => runtime))).toEqual(
      new Set([
        {
          entry: "@voyant-travel/catalog-react/admin",
          export: "createCatalogAdminExtension",
        },
      ]),
    )
  })
})
