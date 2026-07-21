import { describe, expect, it } from "vitest"

import {
  DEFAULT_MANAGED_CLOUD_PROVIDERS,
  DEPLOYMENT_PROVIDER_CONTRACTS,
} from "./deployment-types.js"

describe("deployment provider contracts", () => {
  it("exposes only explicit admin and customer auth selectors", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS).toMatchObject({
      adminAuth: "voyant-cloud",
      customerAuth: "better-auth",
    })
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS).not.toHaveProperty("auth")
  })

  it("makes outbound webhook enqueue authority explicit for managed deployments", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS.outboundWebhooks).toBe("postgres")
    expect(DEPLOYMENT_PROVIDER_CONTRACTS.outboundWebhooks).toEqual(["postgres", "host", "none"])
  })

  it("defaults managed search to the shipped Postgres adapter while preserving Typesense selection", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS.search).toBe("postgres")
    expect(DEPLOYMENT_PROVIDER_CONTRACTS.search).toEqual([
      "postgres",
      "typesense",
      "algolia",
      "custom",
      "none",
    ])
  })

  it("makes realtime transport selection explicit", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS.realtime).toBe("voyant-cloud")
    expect(DEPLOYMENT_PROVIDER_CONTRACTS.realtime).toEqual([
      "voyant-cloud",
      "local",
      "custom",
      "none",
    ])
  })
})
