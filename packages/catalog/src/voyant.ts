import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the catalog package. */
export const catalogVoyantModule = defineModule({
  id: "@voyant-travel/catalog",
  packageName: "@voyant-travel/catalog",
  localId: "catalog",
  api: [
    {
      id: "@voyant-travel/catalog#api.admin",
      surface: "admin",
      mount: "catalog",
      runtime: {
        entry: "@voyant-travel/catalog",
        export: "createCatalogSearchHonoModule",
      },
    },
    {
      id: "@voyant-travel/catalog#api.public",
      surface: "public",
      mount: "catalog",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/catalog",
        export: "createCatalogSearchHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/catalog#schema",
      source: "@voyant-travel/catalog/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/catalog#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const catalogBookingEngineVoyantModule = defineModule({
  id: "@voyant-travel/catalog#booking-engine",
  packageName: "@voyant-travel/catalog",
  localId: "catalog.booking-engine",
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
  meta: {
    ownership: "package",
  },
})

export const catalogOffersVoyantPlugin = definePlugin({
  id: "@voyant-travel/catalog#offers-extension",
  packageName: "@voyant-travel/catalog",
  localId: "catalog.offers-extension",
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
  meta: {
    ownership: "package",
  },
})

export default catalogVoyantModule
