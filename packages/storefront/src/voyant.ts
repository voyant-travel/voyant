import { defineModule, requirePort } from "@voyant-travel/core/project"
import {
  storefrontCustomerPortalRuntimePort,
  storefrontPaymentLinkRuntimePort,
  storefrontRuntimePort,
  storefrontVerificationRuntimePort,
} from "./runtime-port.js"

/** Import-cheap deployment declarations owned by the storefront package. */
export const storefrontVoyantModule = defineModule({
  id: "@voyant-travel/storefront",
  packageName: "@voyant-travel/storefront",
  localId: "storefront",
  runtime: { entry: "@voyant-travel/storefront", export: "createStorefrontVoyantRuntime" },
  runtimePorts: [requirePort(storefrontRuntimePort)],
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
  resources: [
    {
      id: "@voyant-travel/storefront#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const storefrontCustomerPortalVoyantModule = defineModule({
  id: "@voyant-travel/storefront#customer-portal",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.customer-portal",
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
      anonymous: ["/contact-exists"],
      runtime: {
        entry: "@voyant-travel/storefront/customer-portal",
        export: "createCustomerPortalHonoModule",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const storefrontVerificationVoyantModule = defineModule({
  id: "@voyant-travel/storefront#verification",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.verification",
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
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/storefront/verification",
        export: "createStorefrontVerificationHonoModule",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const storefrontPaymentLinkVoyantModule = defineModule({
  id: "@voyant-travel/storefront#payment-link",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.payment-link",
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
      anonymous: ["payment-link-config", "payment-link"],
      runtime: {
        entry: "@voyant-travel/storefront/payment-link",
        export: "createPaymentLinkHonoModule",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default storefrontVoyantModule
