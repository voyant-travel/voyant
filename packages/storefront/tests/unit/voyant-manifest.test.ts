import { describe, expect, it } from "vitest"
import {
  storefrontCustomerPortalVoyantModule,
  storefrontPaymentLinkVoyantModule,
  storefrontVerificationVoyantModule,
  storefrontVoyantModule,
} from "../../src/voyant.js"

describe("storefront deployment manifest", () => {
  it("owns the base runtime, persistence, and verification link facets", () => {
    expect(storefrontVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/storefront",
      packageName: "@voyant-travel/storefront",
      api: [
        {
          id: "@voyant-travel/storefront#api.admin",
          surface: "admin",
          mount: "storefront",
          runtime: {
            entry: "@voyant-travel/storefront",
            export: "createStorefrontHonoModule",
          },
        },
        {
          id: "@voyant-travel/storefront#api.public",
          surface: "public",
          mount: "/",
          anonymous: ["/leads", "/newsletter", "/offers"],
          runtime: {
            entry: "@voyant-travel/storefront",
            export: "createStorefrontHonoModule",
          },
        },
      ],
      schema: [
        {
          id: "@voyant-travel/storefront#schema",
          source: "@voyant-travel/storefront/verification/schema",
        },
      ],
      migrations: [
        {
          id: "@voyant-travel/storefront#migrations",
          source: "./migrations",
        },
      ],
      links: [
        {
          id: "@voyant-travel/storefront#linkable.storefrontVerificationChallenge",
          source: "@voyant-travel/storefront/verification",
        },
      ],
      events: [
        {
          id: "@voyant-travel/storefront#event.customer-signal-created",
          eventType: "customer.signal.created",
        },
        {
          id: "@voyant-travel/storefront#event.booking-bootstrap-requested",
          eventType: "storefront.booking.bootstrap.requested",
        },
      ],
      subscribers: [
        {
          id: "@voyant-travel/storefront#subscriber.booking-bootstrap",
          eventType: "storefront.booking.bootstrap.requested",
          source: "@voyant-travel/storefront",
          runtime: {
            entry: "./booking-bootstrap-subscriber",
            export: "storefrontBookingBootstrapSubscriber",
          },
        },
      ],
      resources: [{ id: "@voyant-travel/storefront#resource.database", kind: "database" }],
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
  })

  it("owns package-namespaced storefront fragments", () => {
    expect([
      storefrontCustomerPortalVoyantModule,
      storefrontVerificationVoyantModule,
    ]).toMatchObject([
      {
        schemaVersion: "voyant.module.v1",
        id: "@voyant-travel/storefront#customer-portal",
        packageName: "@voyant-travel/storefront",
        api: [
          {
            id: "@voyant-travel/storefront#customer-portal.api",
            surface: "public",
            mount: "customer-portal",
            anonymous: ["/contact-exists"],
            runtime: {
              entry: "@voyant-travel/storefront/customer-portal",
              export: "createCustomerPortalHonoModule",
            },
          },
        ],
      },
      {
        schemaVersion: "voyant.module.v1",
        id: "@voyant-travel/storefront#verification",
        packageName: "@voyant-travel/storefront",
        api: [
          {
            id: "@voyant-travel/storefront#verification.api",
            surface: "public",
            mount: "storefront-verification",
            anonymous: true,
            runtime: {
              entry: "@voyant-travel/storefront/verification",
              export: "createStorefrontVerificationHonoModule",
            },
          },
        ],
      },
    ])
  })

  it("owns the payment-link bridge", () => {
    expect(storefrontPaymentLinkVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/storefront#payment-link",
      packageName: "@voyant-travel/storefront",
      api: [
        {
          id: "@voyant-travel/storefront#payment-link.api",
          surface: "public",
          mount: "/",
          anonymous: ["payment-link-config", "payment-link"],
          runtime: {
            entry: "@voyant-travel/storefront/payment-link",
            export: "createPaymentLinkHonoModule",
          },
        },
      ],
    })
  })
})
