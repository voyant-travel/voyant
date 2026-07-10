import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declarations owned by the storefront package. */
export const storefrontVoyantModule = defineModule({
  id: "@voyant-travel/storefront",
  packageName: "@voyant-travel/storefront",
  localId: "storefront",
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
  meta: {
    ownership: "package",
  },
})

export const storefrontCustomerPortalVoyantModule = defineModule({
  id: "@voyant-travel/storefront#customer-portal",
  packageName: "@voyant-travel/storefront",
  localId: "storefront.customer-portal",
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
  api: [
    {
      id: "@voyant-travel/storefront#payment-link.api",
      surface: "public",
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
