import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { workflowRunnerRegistryRuntimePort } from "@voyant-travel/workflow-runs/runtime-port"
import {
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "./checkout/runtime-ports.js"
import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "./promotions/runtime-ports.js"

const commerceAdminRouteId = "@voyant-travel/commerce#admin.route.promotions-index"
const commerceAdminRuntime = {
  entry: "@voyant-travel/commerce-react/admin",
  export: "createCommerceAdminExtension",
} as const

const promotionAffectedAllFilter = {
  eventType: "promotion.changed",
  id: "ef_6f8e4b4ce409d04c",
  input: {
    object: {
      offerId: { path: "data.offerId" },
      source: { path: "data.source" },
    },
  },
  payloadHash: "6f8e4b4ce409d04c",
  targetWorkflowId: "promotions.reindex-all-products",
  where: {
    eq: [{ path: "data.affected.kind" }, { lit: "all" }],
  },
} as const

/** Import-cheap deployment declaration owned by the commerce package. */
export const commerceVoyantModule = defineModule({
  id: "@voyant-travel/commerce",
  packageName: "@voyant-travel/commerce",
  localId: "commerce",
  runtimePorts: [
    requirePort(promotionRedemptionDatabaseRuntimePort),
    requirePort(promotionsBulkReindexRuntimePort),
  ],
  api: [
    {
      id: "@voyant-travel/commerce#api.pricing.admin",
      surface: "admin",
      mount: "pricing",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "pricingHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.pricing.public",
      surface: "public",
      mount: "pricing",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "pricingHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.markets.admin",
      surface: "admin",
      mount: "markets",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "marketsHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.markets.public",
      surface: "public",
      mount: "markets",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "marketsHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.sellability.admin",
      surface: "admin",
      mount: "sellability",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "sellabilityHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.promotions.admin",
      surface: "admin",
      mount: "promotions",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "promotionsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/commerce#schema",
      source: "@voyant-travel/commerce/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/commerce#migrations",
      source: "./migrations",
    },
  ],
  events: [
    {
      id: "@voyant-travel/commerce#event.promotion.changed",
      eventType: "promotion.changed",
    },
    {
      id: "@voyant-travel/commerce#event.pricing.rule.changed",
      eventType: "pricing.rule.changed",
    },
    {
      id: "@voyant-travel/commerce#event.inquiry.created",
      eventType: "inquiry.created",
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/commerce#subscriber.promotion-redemption-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/commerce/promotion-redemption-subscriber",
      runtime: {
        entry: "./promotion-redemption-subscriber",
        export: "createPromotionRedemptionSubscriberGraphRuntime",
      },
    },
    {
      id: "@voyant-travel/commerce#subscriber.ef_6f8e4b4ce409d04c",
      eventType: "promotion.changed",
      eventFilterId: promotionAffectedAllFilter.id,
      workflowId: "promotions.reindex-all-products",
      filter: promotionAffectedAllFilter,
      source: "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest",
      runtime: {
        entry: "./promotions/workflow-bulk-reindex-manifest",
        export: "promotionAffectedAllFilter",
      },
    },
  ],
  workflows: [
    {
      id: "promotions.reindex-all-products",
      config: {
        defaultRuntime: "node",
      },
      source: "@voyant-travel/commerce/promotions/workflow-bulk-reindex",
      runtime: {
        entry: "./promotions/workflow-bulk-reindex",
        export: "bulkReindexProductsWorkflow",
      },
    },
  ],
  admin: {
    copy: [
      {
        id: "@voyant-travel/commerce#admin.copy.promotions",
        namespace: "commerce.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/commerce-react/promotions/i18n",
          export: "promotionsUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: commerceAdminRouteId,
        path: "/promotions",
        runtime: commerceAdminRuntime,
        copy: [
          {
            namespace: "commerce.admin",
            key: "promotionsPage.title",
          },
        ],
      },
    ],
    nav: [
      {
        id: "@voyant-travel/commerce#admin.nav.promotions",
        routeId: commerceAdminRouteId,
        label: {
          namespace: "commerce.admin",
          key: "promotionsPage.title",
        },
        order: 50,
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

export const commerceCatalogCheckoutVoyantPlugin = defineExtension({
  id: "@voyant-travel/commerce#catalog-checkout-extension",
  packageName: "@voyant-travel/commerce",
  localId: "commerce.catalog-checkout-extension",
  runtimePorts: [
    requirePort(catalogCheckoutDatabaseRuntimePort),
    requirePort(catalogCheckoutLegalRuntimePort),
    requirePort(catalogCheckoutContractPdfRuntimePort),
    requirePort(workflowRunnerRegistryRuntimePort),
  ],
  api: [
    {
      id: "@voyant-travel/commerce#catalog-checkout-extension.api",
      surface: "public",
      mount: "catalog",
      runtime: {
        entry: "@voyant-travel/commerce/checkout",
        export: "createCatalogCheckoutHonoExtension",
      },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/commerce#subscriber.catalog-checkout-contract-document-generated",
      eventType: "contract.document.generated",
      source: "@voyant-travel/commerce/catalog-checkout-subscribers",
      runtime: {
        entry: "./catalog-checkout-subscribers",
        export: "createAcceptanceSignatureSubscriberGraphRuntime",
      },
    },
    {
      id: "@voyant-travel/commerce#subscriber.catalog-checkout-payment-completed",
      eventType: "payment.completed",
      source: "@voyant-travel/commerce/catalog-checkout-subscribers",
      runtime: {
        entry: "./catalog-checkout-subscribers",
        export: "createCheckoutFinalizeSubscriberGraphRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const commerceBookingMaintenanceVoyantPlugin = defineExtension({
  id: "@voyant-travel/commerce#booking-maintenance-extension",
  packageName: "@voyant-travel/commerce",
  localId: "commerce.booking-maintenance-extension",
  api: [
    {
      id: "@voyant-travel/commerce#booking-maintenance-extension.api",
      surface: "admin",
      mount: "bookings",
      runtime: {
        entry: "@voyant-travel/commerce/checkout",
        export: "createBookingMaintenanceHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default commerceVoyantModule
