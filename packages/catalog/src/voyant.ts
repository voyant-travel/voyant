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
  events: [
    { id: "@voyant-travel/catalog#event.entity.created", eventType: "catalog.entity.created" },
    { id: "@voyant-travel/catalog#event.entity.updated", eventType: "catalog.entity.updated" },
    { id: "@voyant-travel/catalog#event.entity.archived", eventType: "catalog.entity.archived" },
    { id: "@voyant-travel/catalog#event.entity.deleted", eventType: "catalog.entity.deleted" },
    {
      id: "@voyant-travel/catalog#event.entity.price-changed",
      eventType: "catalog.entity.price.changed",
    },
    {
      id: "@voyant-travel/catalog#event.entity.availability-changed",
      eventType: "catalog.entity.availability.changed",
    },
    {
      id: "@voyant-travel/catalog#event.entity.overlay-changed",
      eventType: "catalog.entity.overlay.changed",
    },
    {
      id: "@voyant-travel/catalog#event.entity.drift-detected",
      eventType: "catalog.entity.drift.detected",
    },
    {
      id: "@voyant-travel/catalog#event.entity.reference-missing",
      eventType: "catalog.entity.reference.missing",
    },
    {
      id: "@voyant-travel/catalog#event.booking.committed",
      eventType: "catalog.booking.committed",
    },
    {
      id: "@voyant-travel/catalog#event.booking.cancelled",
      eventType: "catalog.booking.cancelled",
    },
    {
      id: "@voyant-travel/catalog#event.source.disconnected",
      eventType: "catalog.source.disconnected",
    },
    {
      id: "@voyant-travel/catalog#event.source.reconnected",
      eventType: "catalog.source.reconnected",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/catalog#access.catalog",
        resource: "catalog",
        actions: ["read", "search"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/catalog#tool.search-catalog",
      name: "search_catalog",
      runtime: { entry: "@voyant-travel/catalog/tools", export: "searchCatalogTool" },
      requiredScopes: ["catalog:search"],
    },
    {
      id: "@voyant-travel/catalog#tool.get-catalog-entry",
      name: "get_catalog_entry",
      runtime: { entry: "@voyant-travel/catalog/tools", export: "getCatalogEntryTool" },
      requiredScopes: ["catalog:read"],
    },
  ],
  webhooks: [
    {
      id: "@voyant-travel/catalog#webhook.entity-created",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.created",
    },
    {
      id: "@voyant-travel/catalog#webhook.entity-updated",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.updated",
    },
    {
      id: "@voyant-travel/catalog#webhook.entity-archived",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.archived",
    },
    {
      id: "@voyant-travel/catalog#webhook.entity-deleted",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.deleted",
    },
    {
      id: "@voyant-travel/catalog#webhook.entity-price-changed",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.price-changed",
    },
    {
      id: "@voyant-travel/catalog#webhook.entity-availability-changed",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.availability-changed",
    },
    {
      id: "@voyant-travel/catalog#webhook.entity-reference-missing",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.entity.reference-missing",
    },
    {
      id: "@voyant-travel/catalog#webhook.booking-committed",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.booking.committed",
    },
    {
      id: "@voyant-travel/catalog#webhook.booking-cancelled",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.booking.cancelled",
    },
    {
      id: "@voyant-travel/catalog#webhook.source-disconnected",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.source.disconnected",
    },
    {
      id: "@voyant-travel/catalog#webhook.source-reconnected",
      direction: "outbound",
      eventId: "@voyant-travel/catalog#event.source.reconnected",
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
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
