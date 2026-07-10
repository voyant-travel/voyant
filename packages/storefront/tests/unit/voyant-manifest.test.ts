import { describe, expect, it } from "vitest"
import {
  storefrontCustomerPortalVoyantModule,
  storefrontVerificationVoyantModule,
  storefrontVoyantModule,
} from "../../src/voyant.js"

describe("storefront deployment manifest", () => {
  it("keeps the selected base unit schema-only", () => {
    expect(storefrontVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/storefront",
      packageName: "@voyant-travel/storefront",
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
    })
    expect(storefrontVoyantModule.api).toBeUndefined()
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
            runtime: {
              entry: "@voyant-travel/storefront/verification",
              export: "createStorefrontVerificationHonoModule",
            },
          },
        ],
      },
    ])
  })
})
