import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declarations owned by the storefront package. */
export const storefrontVoyantModule = defineModule({
  id: "@voyant-travel/storefront",
  packageName: "@voyant-travel/storefront",
  localId: "storefront",
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
      surface: "admin",
      mount: "@voyant-travel/storefront/customer-portal",
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
      surface: "admin",
      mount: "@voyant-travel/storefront/verification",
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

export default storefrontVoyantModule
