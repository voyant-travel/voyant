import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
  voyantWorkflowServiceContributionsPort,
} from "@voyant-travel/core/project"
import { financeOperatorSettingsRuntimePort } from "@voyant-travel/finance/runtime-port"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "./api-runtime-ports.js"
import { catalogBookingSnapshotSubscriberDeclaration } from "./booking-snapshot-subscriber-declaration.js"
import { catalogContentRuntimePort } from "./content-runtime-port.js"
import { catalogIndexSubscriberDeclarations } from "./index-subscriber-declarations.js"
import { catalogIndexerProviderPort } from "./indexer/provider.js"
import {
  catalogAccommodationsRuntimeExtensionPort,
  catalogChartersRuntimeExtensionPort,
  catalogCommerceRuntimeExtensionPort,
  catalogCruisesRuntimeExtensionPort,
  catalogDistributionRuntimeExtensionPort,
  catalogInventoryRuntimeExtensionPort,
  catalogOperationsRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "./runtime-contracts.js"
import {
  catalogBookingSnapshotRuntimePort,
  catalogProjectionRuntimePort,
} from "./subscriber-runtime-ports.js"
import { catalogEventDeclarations, catalogWebhookDeclarations } from "./voyant-events.js"

// Importing Cruises here would create a Catalog <-> Cruises package cycle.
const cruisesRoutesRuntimePortReference = { id: "cruises.routes-runtime" } as const

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
  requires: {
    ports: [
      requirePort(catalogIndexerProviderPort, { optional: true }),
      requirePort(catalogAccommodationsRuntimeExtensionPort),
      requirePort(catalogChartersRuntimeExtensionPort),
      requirePort(catalogCommerceRuntimeExtensionPort),
      requirePort(catalogDistributionRuntimeExtensionPort),
      requirePort(catalogCruisesRuntimeExtensionPort),
      requirePort(catalogInventoryRuntimeExtensionPort),
      requirePort(catalogOperationsRuntimeExtensionPort),
      requirePort(financeOperatorSettingsRuntimePort),
    ],
  },
  provides: {
    capabilities: ["catalog.data-owner"],
    ports: [
      providePort(catalogSearchRuntimePort),
      providePort(catalogContentRuntimePort),
      providePort(catalogProjectionRuntimePort),
      providePort(catalogBookingSnapshotRuntimePort),
      providePort(catalogRuntimeServicesPort),
      providePort(voyantWorkflowServiceContributionsPort),
      cruisesRoutesRuntimePortReference,
    ],
  },
  runtimePorts: [
    requirePort(catalogSearchRuntimePort),
    requirePort(catalogProjectionRuntimePort),
    requirePort(catalogBookingSnapshotRuntimePort),
    requirePort(voyantWorkflowServiceContributionsPort, {
      optional: true,
      cardinality: "many",
    }),
  ],
  api: [
    {
      id: "@voyant-travel/catalog#api.admin",
      surface: "admin",
      mount: "catalog",
      openapi: { document: "catalog" },
      runtime: {
        entry: "@voyant-travel/catalog/graph-runtime",
        export: "createCatalogSearchVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/catalog#api.public",
      surface: "public",
      mount: "catalog",
      openapi: { document: "catalog" },
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
  config: [
    {
      id: "@voyant-travel/catalog#config.typesense-host",
      key: "TYPESENSE_HOST",
      required: false,
    },
  ],
  secrets: [
    {
      id: "@voyant-travel/catalog#secret.typesense-api-key",
      key: "TYPESENSE_API_KEY",
      required: false,
      description: "Typesense API key used by the selected catalog indexer provider.",
      rotation: "replace-only",
    },
  ],
  providers: [
    {
      id: "@voyant-travel/catalog#provider.typesense",
      port: "catalog.indexer",
      selection: { role: "search", value: "typesense" },
      uses: {
        config: ["@voyant-travel/catalog#config.typesense-host"],
        secrets: ["@voyant-travel/catalog#secret.typesense-api-key"],
      },
      runtime: {
        entry: "@voyant-travel/catalog/indexer/typesense-provider",
        export: "createTypesenseGraphIndexerProvider",
      },
      config: { engine: "typesense" },
    },
  ],
  events: catalogEventDeclarations,
  subscribers: [
    ...catalogIndexSubscriberDeclarations.map((subscriber) => ({
      ...subscriber,
      runtime: {
        entry: "@voyant-travel/catalog/index-subscribers",
        export: catalogIndexSubscriberRuntimeExports[subscriber.eventType],
      },
    })),
    {
      ...catalogBookingSnapshotSubscriberDeclaration,
      runtime: {
        entry: "@voyant-travel/catalog/booking-snapshot-subscriber",
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
        entry: "@voyant-travel/catalog/draft-reaper-workflow",
        export: "catalogDraftReaperWorkflow",
      },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/catalog#access.catalog",
        resource: "catalog",
        label: "Catalog",
        description: "Read and search the selected product catalog.",
        actions: [
          {
            action: "read",
            label: "Read catalog entries",
            description: "Read individual catalog entries and their projections.",
          },
          {
            action: "search",
            label: "Search catalog",
            description: "Search catalog entries and product projections.",
          },
          {
            action: "quote",
            label: "Quote catalog entries",
            description: "Resolve and persist short-lived live catalog quotes.",
            sensitive: true,
          },
        ],
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
      risk: "low",
    },
    {
      id: "@voyant-travel/catalog#tool.get-catalog-entry",
      name: "get_catalog_entry",
      runtime: { entry: "@voyant-travel/catalog/tools", export: "getCatalogEntryTool" },
      requiredScopes: ["catalog:read"],
      context: ["catalog"],
      risk: "low",
    },
  ],
  webhooks: catalogWebhookDeclarations,
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
      requiredScopes: ["catalog:read"],
      runtime: catalogAdminRuntime,
    })),
    nav: [
      {
        id: "@voyant-travel/catalog#admin.nav.catalog",
        routeId: "@voyant-travel/catalog#admin.route.products-index",
        label: {
          namespace: "catalog.admin",
          key: "catalogPage.title",
        },
      },
    ],
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
  requires: { capabilities: ["catalog.data-owner"] },
  provides: { ports: [providePort(catalogBookingRuntimePort)] },
  runtimePorts: [requirePort(catalogBookingRuntimePort)],
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
  tools: [
    {
      id: "@voyant-travel/catalog#booking-engine#tool.quote-catalog-entity",
      name: "quote_catalog_entity",
      runtime: {
        entry: "@voyant-travel/catalog/tools",
        export: "quoteCatalogEntityTool",
      },
      requiredScopes: ["catalog:quote"],
      context: ["catalog"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/catalog#booking-engine#tool.commit-catalog-booking",
      name: "commit_catalog_booking",
      runtime: {
        entry: "@voyant-travel/catalog/tools",
        export: "commitCatalogBookingTool",
      },
      requiredScopes: ["catalog:read", "bookings:write"],
      context: ["catalog"],
      risk: "critical",
    },
    {
      id: "@voyant-travel/catalog#booking-engine#tool.list-catalog-orders",
      name: "list_catalog_orders",
      runtime: {
        entry: "@voyant-travel/catalog/tools",
        export: "listCatalogOrdersTool",
      },
      requiredScopes: ["bookings:read"],
      context: ["catalog"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/catalog#booking-engine#tool.get-catalog-order",
      name: "get_catalog_order",
      runtime: {
        entry: "@voyant-travel/catalog/tools",
        export: "getCatalogOrderTool",
      },
      requiredScopes: ["bookings:read"],
      context: ["catalog"],
      risk: "medium",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/catalog#booking-engine#action.quote-catalog-entity",
      version: "v1",
      kind: "execute",
      targetType: "catalog-quote",
      resource: "catalog",
      action: "quote",
      requiredScopes: ["catalog:quote"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      reversible: true,
      from: {
        tools: ["@voyant-travel/catalog#booking-engine#tool.quote-catalog-entity"],
      },
    },
    {
      id: "@voyant-travel/catalog#booking-engine#action.commit-catalog-booking",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      resource: "bookings",
      action: "write",
      requiredScopes: ["catalog:read", "bookings:write"],
      risk: "critical",
      ledger: "required",
      approval: "required",
      reversible: false,
      from: {
        tools: ["@voyant-travel/catalog#booking-engine#tool.commit-catalog-booking"],
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
  provides: { ports: [providePort(catalogOffersRuntimePort)] },
  runtimePorts: [requirePort(catalogOffersRuntimePort)],
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
  meta: {
    ownership: "package",
  },
})

export default catalogVoyantModule
