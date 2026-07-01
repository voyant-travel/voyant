import { describe, expect, it } from "vitest"

import { getLegalPolicyAcceptancesQueryOptions } from "./query-options.js"

describe("legal policy acceptance query options", () => {
  it("includes the policy id filter in the acceptances request", async () => {
    const requestedUrls: string[] = []
    const options = getLegalPolicyAcceptancesQueryOptions(
      {
        baseUrl: "https://admin.example/api",
        fetcher: async (url) => {
          requestedUrls.push(url)
          return new Response(JSON.stringify({ data: [], total: 0, limit: 50, offset: 0 }))
        },
      },
      { policyId: "pol_123", limit: 50, offset: 0 },
    )

    const queryFn = options.queryFn as () => Promise<unknown>
    await queryFn()

    expect(requestedUrls).toEqual([
      "https://admin.example/api/v1/admin/legal/policies/acceptances?policyId=pol_123&limit=50&offset=0",
    ])
  })
})
