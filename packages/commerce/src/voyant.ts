import {
  catalogCommerceRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/ports"
import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
} from "@voyant-travel/core/project"
import {
  financeAccommodationsPaymentPolicyRuntimePort,
  financeCruisesPaymentPolicyRuntimePort,
  financeDistributionPaymentPolicyRuntimePort,
  financeInventoryPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { checkoutInquiryRuntimePort } from "@voyant-travel/quotes-contracts/runtime-port"
import { workflowRunnerRegistryRuntimePort } from "@voyant-travel/workflow-runs/runtime-port"
import {
  bookingMaintenanceRuntimePort,
  catalogCheckoutApiRuntimePort,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "./checkout/runtime-ports.js"
import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "./promotions/runtime-ports.js"
import {
  commerceCardPaymentRuntimePort,
  commerceInventoryRuntimePort,
  commerceLegalRuntimePort,
  commerceOperatorSettingsRuntimePort,
} from "./runtime-port.js"
import { commerceAccess } from "./voyant-access.js"
import {
  inquiryCreatedPayloadSchema,
  pricingRuleChangedPayloadSchema,
  promotionChangedPayloadSchema,
} from "./voyant-event-schemas.js"

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
    requirePort(commerceOperatorSettingsRuntimePort),
    requirePort(commerceInventoryRuntimePort),
    requirePort(commerceLegalRuntimePort),
    requirePort(commerceCardPaymentRuntimePort, { optional: true }),
    requirePort(catalogRuntimeServicesPort),
    requirePort(financeDistributionPaymentPolicyRuntimePort),
    requirePort(financeAccommodationsPaymentPolicyRuntimePort),
    requirePort(financeCruisesPaymentPolicyRuntimePort),
    requirePort(financeInventoryPaymentPolicyRuntimePort),
    requirePort(checkoutInquiryRuntimePort),
  ],
  provides: {
    ports: [
      providePort(catalogCommerceRuntimeExtensionPort),
      providePort(promotionRedemptionDatabaseRuntimePort),
      providePort(promotionsBulkReindexRuntimePort),
    ],
  },
  api: [
    {
      id: "@voyant-travel/commerce#api.pricing.admin",
      surface: "admin",
      mount: "pricing",
      openapi: { document: "pricing" },
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "pricingHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.pricing.public",
      surface: "public",
      mount: "pricing",
      openapi: { document: "pricing" },
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "pricingHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.markets.admin",
      surface: "admin",
      mount: "markets",
      openapi: { document: "markets" },
      resource: "markets",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "marketsHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.markets.public",
      surface: "public",
      mount: "markets",
      openapi: { document: "markets" },
      resource: "markets",
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
      openapi: { document: "sellability" },
      resource: "sellability",
      runtime: {
        entry: "@voyant-travel/commerce",
        export: "sellabilityHonoModule",
      },
    },
    {
      id: "@voyant-travel/commerce#api.promotions.admin",
      surface: "admin",
      mount: "promotions",
      openapi: { document: "promotions" },
      resource: "promotions",
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
  access: commerceAccess,
  events: [
    {
      id: "@voyant-travel/commerce#event.promotion.changed",
      eventType: "promotion.changed",
      version: "1.0.0",
      payloadSchema: promotionChangedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "commerce", category: "domain" },
    },
    {
      id: "@voyant-travel/commerce#event.pricing.rule.changed",
      eventType: "pricing.rule.changed",
      version: "1.0.0",
      payloadSchema: pricingRuleChangedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "commerce", category: "domain" },
    },
    {
      id: "@voyant-travel/commerce#event.inquiry.created",
      eventType: "inquiry.created",
      version: "1.0.0",
      payloadSchema: inquiryCreatedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "commerce", category: "domain" },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/commerce#subscriber.promotion-redemption-booking-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/commerce/promotion-redemption-subscriber",
      runtime: {
        entry: "@voyant-travel/commerce/promotion-redemption-subscriber",
        export: "createPromotionRedemptionSubscriberGraphRuntime",
      },
    },
    {
      id: "@voyant-travel/commerce#subscriber.ef_6f8e4b4ce409d04c",
      eventType: "promotion.changed",
      eventFilterId: promotionAffectedAllFilter.id,
      workflowId: "promotions.reindex-all-products",
      filter: promotionAffectedAllFilter,
      source: "@voyant-travel/commerce/product-reindex-workflow-manifest",
      runtime: {
        entry: "@voyant-travel/commerce/product-reindex-workflow-manifest",
        export: "promotionAffectedAllFilter",
      },
    },
  ],
  workflows: [
    {
      id: "commerce.process-promotion-boundaries",
      config: {
        defaultRuntime: "node",
        schedule: { cron: "*/5 * * * *", name: "every-5-minutes" },
      },
      source: "@voyant-travel/commerce/promotion-boundary-workflow",
      runtime: {
        entry: "@voyant-travel/commerce/promotion-boundary-workflow",
        export: "promotionBoundarySchedulerWorkflow",
      },
    },
    {
      id: "promotions.reindex-all-products",
      config: {
        defaultRuntime: "node",
      },
      source: "@voyant-travel/commerce/product-reindex-workflow",
      runtime: {
        entry: "@voyant-travel/commerce/product-reindex-workflow",
        export: "bulkReindexProductsWorkflow",
      },
    },
  ],
  admin: {
    compositionOrder: 80,
    runtime: {
      entry: "@voyant-travel/commerce-react/admin",
      export: "createSelectedCommerceAdminExtension",
    },
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
  provides: {
    ports: [
      providePort(catalogCheckoutApiRuntimePort),
      providePort(catalogCheckoutDatabaseRuntimePort),
      providePort(catalogCheckoutLegalRuntimePort),
      providePort(catalogCheckoutContractPdfRuntimePort),
    ],
  },
  runtimePorts: [
    requirePort(catalogCheckoutApiRuntimePort),
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
      openapi: { document: "catalog" },
      runtime: {
        entry: "@voyant-travel/commerce/checkout",
        export: "createCatalogCheckoutGraphExtension",
      },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/commerce#subscriber.catalog-checkout-contract-document-generated",
      eventType: "contract.document.generated",
      source: "@voyant-travel/commerce/catalog-checkout-subscribers",
      runtime: {
        entry: "@voyant-travel/commerce/catalog-checkout-subscribers",
        export: "createAcceptanceSignatureSubscriberGraphRuntime",
      },
    },
    {
      id: "@voyant-travel/commerce#subscriber.catalog-checkout-payment-completed",
      eventType: "payment.completed",
      source: "@voyant-travel/commerce/catalog-checkout-subscribers",
      runtime: {
        entry: "@voyant-travel/commerce/catalog-checkout-subscribers",
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
  provides: { ports: [providePort(bookingMaintenanceRuntimePort)] },
  runtime: {
    entry: "@voyant-travel/commerce/checkout",
    export: "createBookingMaintenanceVoyantRuntime",
  },
  runtimePorts: [requirePort(bookingMaintenanceRuntimePort)],
  api: [
    {
      id: "@voyant-travel/commerce#booking-maintenance-extension.api",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
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
