import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "./api-runtime-ports.js"
import { catalogBookingSnapshotSubscriberDeclaration } from "./booking-snapshot-subscriber-declaration.js"
import { catalogIndexSubscriberDeclarations } from "./index-subscriber-declarations.js"
import {
  catalogBookingSnapshotRuntimePort,
  catalogProjectionRuntimePort,
} from "./subscriber-runtime-ports.js"

const catalogAdminRuntime = {
  entry: "@voyant-travel/catalog-react/admin",
  export: "createCatalogAdminExtension",
} as const

const catalogIndexSubscriberRuntimeExports = {
  "product.created": "createCatalogProductCreatedIndexSubscriberGraphRuntime",
  "product.updated": "createCatalogProductUpdatedIndexSubscriberGraphRuntime",
  "product.deleted": "createCatalogProductDeletedIndexSubscriberGraphRuntime",
  "product.content.changed": "createCatalogProductContentChangedIndexSubscriberGraphRuntime",
  "availability.slot.changed": "createCatalogAvailabilityChangedIndexSubscriberGraphRuntime",
  "pricing.rule.changed": "createCatalogPricingChangedIndexSubscriberGraphRuntime",
  "product.publication.changed": "createCatalogPublicationChangedIndexSubscriberGraphRuntime",
  "promotion.changed": "createCatalogPromotionChangedIndexSubscriberGraphRuntime",
} as const

/** Import-cheap deployment declaration owned by the catalog package. */
export const catalogVoyantModule = defineModule({
  id: "@voyant-travel/catalog",
  packageName: "@voyant-travel/catalog",
  localId: "catalog",
  runtimePorts: [
    requirePort(catalogSearchRuntimePort),
    requirePort(catalogProjectionRuntimePort),
    requirePort(catalogBookingSnapshotRuntimePort),
  ],
  api: [
    {
      id: "@voyant-travel/catalog#api.admin",
      surface: "admin",
      mount: "catalog",
      runtime: {
        entry: "@voyant-travel/catalog/graph-runtime",
        export: "createCatalogSearchVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/catalog#api.public",
      surface: "public",
      mount: "catalog",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/catalog/graph-runtime",
        export: "createCatalogSearchVoyantRuntime",
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
  subscribers: [
    ...catalogIndexSubscriberDeclarations.map((subscriber) => ({
      ...subscriber,
      runtime: {
        entry: "./index-subscribers",
        export: catalogIndexSubscriberRuntimeExports[subscriber.eventType],
      },
    })),
    {
      ...catalogBookingSnapshotSubscriberDeclaration,
      runtime: {
        entry: "./booking-snapshot-subscriber",
        export: "createCatalogBookingSnapshotSubscriberGraphRuntime",
      },
    },
  ],
  workflows: [
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
      context: ["catalog"],
    },
    {
      id: "@voyant-travel/catalog#tool.get-catalog-entry",
      name: "get_catalog_entry",
      runtime: { entry: "@voyant-travel/catalog/tools", export: "getCatalogEntryTool" },
      requiredScopes: ["catalog:read"],
      context: ["catalog"],
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
  admin: {
    compositionOrder: 2,
    runtime: {
      entry: "@voyant-travel/catalog-react/admin",
      export: "createSelectedCatalogAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/catalog#admin.copy",
        namespace: "catalog.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/catalog-react/i18n",
          export: "catalogUiMessageDefinitions",
        },
      },
    ],
    routes: (
      [
        ["index", "/catalog"],
        ["products-index", "/catalog/products"],
        ["products-detail", "/catalog/products/$productId"],
        ["excursions-index", "/catalog/excursions"],
        ["excursions-detail", "/catalog/excursions/$id"],
        ["tours-index", "/catalog/tours"],
        ["tours-detail", "/catalog/tours/$id"],
        ["cruises-index", "/catalog/cruises"],
        ["cruises-detail", "/catalog/cruises/$id"],
        ["accommodations-index", "/catalog/accommodations"],
        ["accommodations-detail", "/catalog/accommodations/$id"],
      ] as const
    ).map(([id, path]) => ({
      id: `@voyant-travel/catalog#admin.route.${id}`,
      path,
      runtime: catalogAdminRuntime,
    })),
  },
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
  runtimePorts: [requirePort(catalogBookingRuntimePort)],
  api: [
    {
      id: "@voyant-travel/catalog#booking-engine.api.admin",
      surface: "admin",
      mount: "catalog",
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
      transactional: ["/book", "/holds", "/quote", "/quotes/batch"],
      runtime: {
        entry: "@voyant-travel/catalog/graph-runtime",
        export: "createCatalogBookingVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const catalogOffersVoyantPlugin = defineExtension({
  id: "@voyant-travel/catalog#offers-extension",
  packageName: "@voyant-travel/catalog",
  localId: "catalog.offers-extension",
  runtimePorts: [requirePort(catalogOffersRuntimePort)],
  api: [
    {
      id: "@voyant-travel/catalog#offers-extension.api",
      surface: "admin",
      mount: "catalog",
      runtime: {
        entry: "@voyant-travel/catalog/graph-runtime",
        export: "createCatalogOffersVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default catalogVoyantModule
