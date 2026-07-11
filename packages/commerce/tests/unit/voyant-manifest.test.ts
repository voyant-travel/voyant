import { workflowRunnerRegistryRuntimePort } from "@voyant-travel/workflow-runs/runtime-port"
import { describe, expect, it } from "vitest"
import {
  catalogCheckoutApiRuntimePort,
  catalogCheckoutContractPdfRuntimePort,
  catalogCheckoutDatabaseRuntimePort,
  catalogCheckoutLegalRuntimePort,
} from "../../src/checkout/runtime-ports.js"
import {
  promotionRedemptionDatabaseRuntimePort,
  promotionsBulkReindexRuntimePort,
} from "../../src/promotions/runtime-ports.js"
import {
  commerceBookingMaintenanceVoyantPlugin,
  commerceCatalogCheckoutVoyantPlugin,
  commerceVoyantModule,
} from "../../src/voyant.js"

describe("commerce deployment manifest", () => {
  it("owns runtime, persistence, and promotion orchestration facets", () => {
    expect(commerceVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/commerce",
      packageName: "@voyant-travel/commerce",
      runtimePorts: [
        { id: promotionRedemptionDatabaseRuntimePort.id },
        { id: promotionsBulkReindexRuntimePort.id },
      ],
      api: [
        {
          id: "@voyant-travel/commerce#api.pricing.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "pricingHonoModule",
          },
        },
        {
          id: "@voyant-travel/commerce#api.pricing.public",
          surface: "public",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "pricingHonoModule",
          },
        },
        {
          id: "@voyant-travel/commerce#api.markets.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "marketsHonoModule",
          },
        },
        {
          id: "@voyant-travel/commerce#api.markets.public",
          surface: "public",
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "marketsHonoModule",
          },
        },
        {
          id: "@voyant-travel/commerce#api.sellability.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "sellabilityHonoModule",
          },
        },
        {
          id: "@voyant-travel/commerce#api.promotions.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/commerce",
            export: "promotionsHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/commerce#schema" }],
      migrations: [{ id: "@voyant-travel/commerce#migrations" }],
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
      workflows: [
        {
          id: "promotions.reindex-all-products",
          config: { defaultRuntime: "node" },
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
          eventFilterId: "ef_6f8e4b4ce409d04c",
          workflowId: "promotions.reindex-all-products",
          filter: {
            where: {
              eq: [{ path: "data.affected.kind" }, { lit: "all" }],
            },
          },
        },
      ],
    })
  })

  it("owns the catalog checkout and booking maintenance bridges", () => {
    expect(commerceCatalogCheckoutVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/commerce#catalog-checkout-extension",
      packageName: "@voyant-travel/commerce",
      runtimePorts: [
        { id: catalogCheckoutApiRuntimePort.id },
        { id: catalogCheckoutDatabaseRuntimePort.id },
        { id: catalogCheckoutLegalRuntimePort.id },
        { id: catalogCheckoutContractPdfRuntimePort.id },
        { id: workflowRunnerRegistryRuntimePort.id },
      ],
      api: [
        {
          id: "@voyant-travel/commerce#catalog-checkout-extension.api",
          surface: "public",
          mount: "catalog",
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
    })
    expect(commerceCatalogCheckoutVoyantPlugin.subscribers).toHaveLength(2)

    expect(commerceBookingMaintenanceVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/commerce#booking-maintenance-extension",
      packageName: "@voyant-travel/commerce",
      runtime: {
        entry: "@voyant-travel/commerce/checkout",
        export: "createBookingMaintenanceVoyantRuntime",
      },
      runtimePorts: [{ id: "commerce.booking-maintenance.runtime" }],
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
    })
  })

  it("declares the promotions route, navigation, and existing copy catalog", () => {
    expect(commerceVoyantModule.admin).toEqual({
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
          id: "@voyant-travel/commerce#admin.route.promotions-index",
          path: "/promotions",
          runtime: {
            entry: "@voyant-travel/commerce-react/admin",
            export: "createCommerceAdminExtension",
          },
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
          routeId: "@voyant-travel/commerce#admin.route.promotions-index",
          label: {
            namespace: "commerce.admin",
            key: "promotionsPage.title",
          },
          order: 50,
        },
      ],
    })
  })
})
