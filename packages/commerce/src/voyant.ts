import {
  catalogCommerceRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/ports"
import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
  type VoyantGraphActionDeclaration,
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

const commerceToolActions = [
  commerceToolAction("resolve-sellability", "sellability", "read"),
  commerceToolAction("list-cancellation-policies", "pricing", "read"),
  commerceToolAction("get-cancellation-policy", "pricing", "read"),
  commerceToolAction("create-cancellation-policy", "pricing", "write"),
  commerceToolAction("update-cancellation-policy", "pricing", "write"),
  commerceToolAction("list-price-catalogs", "pricing", "read"),
  commerceToolAction("get-price-catalog", "pricing", "read"),
  commerceToolAction("create-price-catalog", "pricing", "write"),
  commerceToolAction("update-price-catalog", "pricing", "write"),
  commerceToolAction("list-promotions", "promotions", "read"),
  commerceToolAction("get-promotion", "promotions", "read"),
  commerceToolAction("create-promotion", "promotions", "write"),
  commerceToolAction("update-promotion", "promotions", "write"),
  commerceToolAction("archive-promotion", "promotions", "write"),
] as const

function commerceToolAction(
  suffix: string,
  resource: "sellability" | "pricing" | "promotions",
  action: "read" | "write",
): VoyantGraphActionDeclaration {
  const write = action === "write"
  return {
    id: `@voyant-travel/commerce#action.${suffix}`,
    version: "v1",
    kind: write ? "execute" : "read",
    targetType: resource,
    resource,
    action,
    requiredScopes: [`${resource}:${action}`],
    risk: write ? "medium" : "low",
    ledger: write ? "required" : "optional",
    approval: "never",
    reversible: write,
    allowedActorTypes: ["staff"],
    from: { tools: [`@voyant-travel/commerce#tool.${suffix}`] },
  }
}

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
  tools: [
    {
      id: "@voyant-travel/commerce#tool.resolve-sellability",
      name: "resolve_sellability",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "resolveSellabilityTool" },
      requiredScopes: ["sellability:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.list-cancellation-policies",
      name: "list_cancellation_policies",
      runtime: {
        entry: "@voyant-travel/commerce/tools",
        export: "listCancellationPoliciesTool",
      },
      requiredScopes: ["pricing:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.get-cancellation-policy",
      name: "get_cancellation_policy",
      runtime: {
        entry: "@voyant-travel/commerce/tools",
        export: "getCancellationPolicyTool",
      },
      requiredScopes: ["pricing:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.create-cancellation-policy",
      name: "create_cancellation_policy",
      runtime: {
        entry: "@voyant-travel/commerce/tools",
        export: "createCancellationPolicyTool",
      },
      requiredScopes: ["pricing:write"],
      context: ["commerce"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/commerce#tool.update-cancellation-policy",
      name: "update_cancellation_policy",
      runtime: {
        entry: "@voyant-travel/commerce/tools",
        export: "updateCancellationPolicyTool",
      },
      requiredScopes: ["pricing:write"],
      context: ["commerce"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/commerce#tool.list-price-catalogs",
      name: "list_price_catalogs",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "listPriceCatalogsTool" },
      requiredScopes: ["pricing:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.get-price-catalog",
      name: "get_price_catalog",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "getPriceCatalogTool" },
      requiredScopes: ["pricing:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.create-price-catalog",
      name: "create_price_catalog",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "createPriceCatalogTool" },
      requiredScopes: ["pricing:write"],
      context: ["commerce"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/commerce#tool.update-price-catalog",
      name: "update_price_catalog",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "updatePriceCatalogTool" },
      requiredScopes: ["pricing:write"],
      context: ["commerce"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/commerce#tool.list-promotions",
      name: "list_promotions",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "listPromotionsTool" },
      requiredScopes: ["promotions:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.get-promotion",
      name: "get_promotion",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "getPromotionTool" },
      requiredScopes: ["promotions:read"],
      context: ["commerce"],
      risk: "low",
    },
    {
      id: "@voyant-travel/commerce#tool.create-promotion",
      name: "create_promotion",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "createPromotionTool" },
      requiredScopes: ["promotions:write"],
      context: ["commerce"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/commerce#tool.update-promotion",
      name: "update_promotion",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "updatePromotionTool" },
      requiredScopes: ["promotions:write"],
      context: ["commerce"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/commerce#tool.archive-promotion",
      name: "archive_promotion",
      runtime: { entry: "@voyant-travel/commerce/tools", export: "archivePromotionTool" },
      requiredScopes: ["promotions:write"],
      context: ["commerce"],
      risk: "medium",
    },
  ],
  actions: commerceToolActions,
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
    setupSteps: [{ id: "@voyant-travel/commerce#setup.market", skippable: true }],
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
