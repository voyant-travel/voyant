import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import {
  createCatalogBookingVoyantRuntime,
  createCatalogOffersVoyantRuntime,
  createCatalogSearchVoyantRuntime,
} from "../../src/graph-runtime.js"
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
          openapi: { document: "catalog" },
          runtime: {
            entry: "@voyant-travel/catalog/graph-runtime",
            export: "createCatalogSearchVoyantRuntime",
          },
        },
        {
          id: "@voyant-travel/catalog#api.public",
          surface: "public",
          openapi: { document: "catalog" },
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/catalog/graph-runtime",
            export: "createCatalogSearchVoyantRuntime",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/catalog#schema" }],
      migrations: [{ id: "@voyant-travel/catalog#migrations" }],
    })
  })

  it("owns executable declarations for Catalog indexing and booking snapshots", () => {
    expect(catalogVoyantModule.subscribers).toEqual(
      [
        ["index-product-created", "product.created"],
        ["index-product-updated", "product.updated"],
        ["delete-product", "product.deleted"],
        ["index-product-content-changed", "product.content.changed"],
        ["index-product-availability-changed", "availability.slot.changed"],
        ["index-product-pricing-changed", "pricing.rule.changed"],
        ["index-product-publication-changed", "product.publication.changed"],
        ["index-product-promotion-changed", "promotion.changed"],
        ["capture-booking-snapshot", "booking.confirmed"],
      ].map(([localId, eventType]) => ({
        id: `@voyant-travel/catalog#subscriber.${localId}`,
        eventType,
        source:
          eventType === "booking.confirmed"
            ? "@voyant-travel/catalog/booking-snapshot-subscriber"
            : "@voyant-travel/catalog/index-subscribers",
        runtime:
          eventType === "booking.confirmed"
            ? {
                entry: "./booking-snapshot-subscriber",
                export: "createCatalogBookingSnapshotSubscriberGraphRuntime",
              }
            : {
                entry: "./index-subscribers",
                export: expect.stringMatching(/^createCatalog.+IndexSubscriberGraphRuntime$/),
              },
      })),
    )
    expect(catalogVoyantModule.runtimePorts).toEqual([
      { id: "catalog.search-runtime" },
      { id: "catalog.projection-runtime" },
      { id: "catalog.booking-snapshot-runtime" },
      { id: "voyant.workflow-services", optional: true, cardinality: "many" },
    ])
    expect(catalogVoyantModule.workflows).toEqual([
      {
        id: "catalog.reap-expired-booking-drafts",
        config: {
          defaultRuntime: "node",
          schedule: { cron: "5 * * * *", name: "hourly-at-05" },
        },
        source: "@voyant-travel/catalog/draft-reaper-workflow",
        runtime: {
          entry: "./draft-reaper-workflow",
          export: "catalogDraftReaperWorkflow",
        },
      },
    ])
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
          openapi: { document: "catalog-booking" },
          transactional: ["/book", "/holds", "/orders", "/quote", "/quotes/batch"],
          runtime: {
            entry: "@voyant-travel/catalog/graph-runtime",
            export: "createCatalogBookingVoyantRuntime",
          },
        },
        {
          id: "@voyant-travel/catalog#booking-engine.api.public",
          surface: "public",
          mount: "catalog",
          openapi: { document: "catalog-booking" },
          transactional: ["/book", "/holds", "/quote", "/quotes/batch"],
          runtime: {
            entry: "@voyant-travel/catalog/graph-runtime",
            export: "createCatalogBookingVoyantRuntime",
          },
        },
      ],
      runtimePorts: [{ id: "catalog.booking-runtime" }],
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
          openapi: { document: "catalog" },
          runtime: {
            entry: "@voyant-travel/catalog/graph-runtime",
            export: "createCatalogOffersVoyantRuntime",
          },
        },
      ],
      runtimePorts: [{ id: "catalog.offers-runtime" }],
    })

    expect(isGraphRuntimeFactory(createCatalogSearchVoyantRuntime)).toBe(true)
    expect(isGraphRuntimeFactory(createCatalogBookingVoyantRuntime)).toBe(true)
    expect(isGraphRuntimeFactory(createCatalogOffersVoyantRuntime)).toBe(true)
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
