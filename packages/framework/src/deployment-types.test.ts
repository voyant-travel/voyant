import { describe, expect, it } from "vitest"

import {
  DEFAULT_MANAGED_CLOUD_PROVIDERS,
  DEPLOYMENT_PROVIDER_CONTRACTS,
} from "./deployment-types.js"

describe("deployment provider contracts", () => {
  it("makes outbound webhook enqueue authority explicit for managed deployments", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS.outboundWebhooks).toBe("postgres")
    expect(DEPLOYMENT_PROVIDER_CONTRACTS.outboundWebhooks).toEqual(["postgres", "host", "none"])
  })

  it("defaults managed search to the shipped adapter without advertising absent engines", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS.search).toBe("typesense")
    expect(DEPLOYMENT_PROVIDER_CONTRACTS.search).toEqual(["typesense", "algolia", "custom", "none"])
  })
})
