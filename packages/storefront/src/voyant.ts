import { defineModule, providePort, requirePort } from "@voyant-travel/core/project"
import { bookingBootstrapRequestedEventPayloadSchema } from "./event-payload-schemas.js"
import {
  storefrontBookingIntentsRuntimePort,
  storefrontCustomerPortalRuntimePort,
  storefrontIntakeRuntimePort,
  storefrontOffersRuntimePort,
  storefrontPaymentLinkRuntimePort,
  storefrontVerificationRuntimePort,
} from "./runtime-port.js"

/** Import-cheap deployment declarations owned by the storefront package. */
export const storefrontVoyantModule = defineModule({
  id: "@voyant-travel/storefront",
  packageName: "@voyant-travel/storefront",
  localId: "storefront",
  provides: {
    capabilities: ["storefront.data-owner"],
    ports: [
      providePort(storefrontOffersRuntimePort),
      providePort(storefrontBookingIntentsRuntimePort),
    ],
  },
  runtime: { entry: "@voyant-travel/storefront", export: "createStorefrontVoyantRuntime" },
  runtimePorts: [
    requirePort(storefrontOffersRuntimePort),
    requirePort(storefrontBookingIntentsRuntimePort),
    requirePort(storefrontIntakeRuntimePort),
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
      kind: "linkable",
      source: "@voyant-travel/storefront/verification",
      export: "storefrontVerificationLinkable",
    },
  ],
  events: [
    {
      id: "@voyant-travel/storefront#event.booking-bootstrap-requested",
      eventType: "storefront.booking.bootstrap.requested",
      version: "1.0.0",
      payloadSchema: bookingBootstrapRequestedEventPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "storefront", category: "domain" },
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
  resources: [
    {
      id: "@voyant-travel/storefront#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/storefront#access.storefront",
        resource: "storefront",
        label: "Storefront",
        description: "Manage storefront offers, customer intake, and booking intents.",
        actions: [
          {
            action: "read",
            label: "View storefront",
            description: "View storefront offers, customer intake, and booking intents.",
          },
          {
            action: "write",
            label: "Manage storefront",
            description:
              "Create and update storefront offers, customer intake, and booking intents.",
          },
        ],
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  presentations: [
    {
      id: "@voyant-travel/storefront#presentation.customer",
      runtime: {
        entry: "@voyant-travel/storefront-react/storefront",
        export: "createStorefrontPresentationContribution",
      },
    },
  ],
  meta: {
    ownership: "package",
    agentTools: {
      posture: "not-applicable",
      rationale:
        "The storefront root composes customer HTTP surfaces; submodules own agent capabilities.",
    },
  },
})

export const storefrontCustomerPortalVoyantModule = defineModule({
  id: "@voyant-travel/storefront#customer-portal",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.customer-portal",
  provides: { ports: [providePort(storefrontCustomerPortalRuntimePort)] },
  requires: { capabilities: ["storefront.data-owner"] },
  runtime: {
    entry: "@voyant-travel/storefront/customer-portal",
    export: "createCustomerPortalVoyantRuntime",
  },
  runtimePorts: [requirePort(storefrontCustomerPortalRuntimePort)],
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
  meta: {
    ownership: "package",
    agentTools: {
      posture: "planned",
      rationale:
        "Customer-scoped portal reads and guarded self-service actions need audience-aware Tools.",
      issue: "#3370",
    },
  },
})

export const storefrontVerificationVoyantModule = defineModule({
  id: "@voyant-travel/storefront#verification",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.verification",
  requires: { capabilities: ["storefront.data-owner"] },
  runtime: {
    entry: "@voyant-travel/storefront/verification",
    export: "createStorefrontVerificationVoyantRuntime",
  },
  runtimePorts: [requirePort(storefrontVerificationRuntimePort)],
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
  meta: {
    ownership: "package",
    agentTools: {
      posture: "planned",
      rationale: "Customer verification workflows need audience-aware, guarded Tools.",
      issue: "#3370",
    },
  },
})

export const storefrontPaymentLinkVoyantModule = defineModule({
  id: "@voyant-travel/storefront#payment-link",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.payment-link",
  requires: { capabilities: ["storefront.data-owner"] },
  runtime: {
    entry: "@voyant-travel/storefront/payment-link",
    export: "createPaymentLinkVoyantRuntime",
  },
  runtimePorts: [requirePort(storefrontPaymentLinkRuntimePort)],
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
  meta: {
    ownership: "package",
    agentTools: {
      posture: "planned",
      rationale: "Payment-link creation and inspection need guarded composed Tools.",
      issue: "#3370",
    },
  },
})

export default storefrontVoyantModule
