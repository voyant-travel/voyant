import { describe, expect, it } from "vitest"
import { createStorefrontVoyantRuntime } from "../../src/index.js"
import {
  storefrontBookingIntentsRuntimePort,
  storefrontCustomerPortalRuntimePort,
  storefrontIntakeRuntimePort,
  storefrontOffersRuntimePort,
  storefrontPaymentLinkRuntimePort,
} from "../../src/runtime-port.js"
import {
  storefrontCustomerPortalVoyantModule,
  storefrontPaymentLinkVoyantModule,
  storefrontVerificationVoyantModule,
  storefrontVoyantModule,
} from "../../src/voyant.js"

describe("storefront deployment manifest", () => {
  it("exports import-cheap runtime port contracts", () => {
    expect(storefrontIntakeRuntimePort.id).toBe("storefront.intake.runtime")
    expect(storefrontPaymentLinkRuntimePort.id).toBe("storefront.payment-link.runtime")
  })

  it("owns the base runtime, persistence, and verification link facets", () => {
    expect(storefrontVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/storefront",
      packageName: "@voyant-travel/storefront",
      provides: {
        capabilities: ["storefront.data-owner"],
        ports: [
          { id: storefrontOffersRuntimePort.id },
          { id: storefrontBookingIntentsRuntimePort.id },
        ],
      },
      runtime: { entry: "@voyant-travel/storefront", export: "createStorefrontVoyantRuntime" },
      runtimePorts: [
        { id: "storefront.offers.runtime" },
        { id: "storefront.booking-intents.runtime" },
        { id: "storefront.intake.runtime" },
      ],
      api: [
        {
          id: "@voyant-travel/storefront#api.admin",
          surface: "admin",
          mount: "storefront",
          openapi: { document: "storefront" },
          runtime: {
            entry: "@voyant-travel/storefront",
            export: "createStorefrontHonoModule",
          },
        },
        {
          id: "@voyant-travel/storefront#api.public",
          surface: "public",
          mount: "/",
          resource: "storefront",
          openapi: { document: "storefront" },
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
          export: "storefrontVerificationLinkable",
        },
      ],
      events: [
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
            entry: "@voyant-travel/storefront/booking-bootstrap-subscriber",
            export: "storefrontBookingBootstrapSubscriber",
          },
        },
      ],
      resources: [{ id: "@voyant-travel/storefront#resource.database", kind: "database" }],
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
  })

  it("mounts only selected Storefront API surfaces", async () => {
    const runtime = await createStorefrontVoyantRuntime({
      unitId: "@voyant-travel/storefront",
      projectConfig: {},
      api: [{ id: "storefront.public", surface: "public" }],
      graph: {
        providerSelections: {},
        accessCatalog: { resources: [], presets: [] },
        references: [],
        setupSteps: [],
        tools: [],
      },
      runtimePorts: {},
      hasPort: () => true,
      getPort: async <TProvider>() => ({}) as TProvider,
      getPorts: async <TProvider>() => [] as TProvider[],
    })

    expect(runtime.adminRoutes).toBeUndefined()
    expect(runtime.publicRoutes).toBeDefined()
  })

  it("declares its owned event payload without duplicating Relationships authority", () => {
    const events = new Map(
      storefrontVoyantModule.events?.map(({ eventType, payloadSchema }) => [
        eventType,
        payloadSchema,
      ]),
    )

    expect(events.has("customer.signal.created")).toBe(false)
    expect(events.get("storefront.booking.bootstrap.requested")).toEqual({
      type: "object",
      required: ["intentId"],
      properties: { intentId: { type: "string" } },
      additionalProperties: false,
    })
  })

  it("declares its package-owned branding setup contribution", () => {
    expect(storefrontVoyantModule.admin).toEqual({
      compositionOrder: 30,
      setupSteps: [{ id: "@voyant-travel/storefront#setup.branding", skippable: true }],
      runtime: {
        entry: "@voyant-travel/storefront-react/admin",
        export: "createSelectedStorefrontAdminExtension",
      },
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
        provides: { ports: [{ id: storefrontCustomerPortalRuntimePort.id }] },
        requires: { capabilities: ["storefront.data-owner"] },
        runtime: {
          entry: "@voyant-travel/storefront/customer-portal",
          export: "createCustomerPortalVoyantRuntime",
        },
        runtimePorts: [{ id: "storefront.customer-portal.runtime" }],
        api: [
          {
            id: "@voyant-travel/storefront#customer-portal.api",
            surface: "public",
            mount: "customer-portal",
            resource: "storefront",
            openapi: { document: "customer-portal" },
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
        requires: { capabilities: ["storefront.data-owner"] },
        runtime: {
          entry: "@voyant-travel/storefront/verification",
          export: "createStorefrontVerificationVoyantRuntime",
        },
        runtimePorts: [{ id: "storefront.verification.runtime" }],
        api: [
          {
            id: "@voyant-travel/storefront#verification.api",
            surface: "public",
            mount: "storefront-verification",
            openapi: { document: "storefront-verification" },
            anonymous: true,
            runtime: {
              entry: "@voyant-travel/storefront/verification",
              export: "createStorefrontVerificationHonoModule",
            },
          },
        ],
      },
    ])
    expect(storefrontVoyantModule.provides?.ports).not.toContainEqual({
      id: storefrontCustomerPortalRuntimePort.id,
    })
  })

  it("owns the payment-link bridge", () => {
    expect(storefrontPaymentLinkVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/storefront#payment-link",
      packageName: "@voyant-travel/storefront",
      requires: { capabilities: ["storefront.data-owner"] },
      runtime: {
        entry: "@voyant-travel/storefront/payment-link",
        export: "createPaymentLinkVoyantRuntime",
      },
      runtimePorts: [{ id: "storefront.payment-link.runtime" }],
      api: [
        {
          id: "@voyant-travel/storefront#payment-link.api",
          surface: "public",
          mount: "/",
          resource: "storefront",
          openapi: { document: "payment-link" },
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
