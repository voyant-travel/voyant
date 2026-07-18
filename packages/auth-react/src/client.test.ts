import { describe, expect, it, vi } from "vitest"

import { createAuthBasePathFetcher } from "./client.js"

describe("createAuthBasePathFetcher", () => {
  it("routes only auth calls under the configured API base URL to the selected realm", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    const customerFetcher = createAuthBasePathFetcher(fetcher, {
      baseUrl: "https://storefront.example/api/",
      authBasePath: "/auth/customer/",
    })

    await customerFetcher("https://storefront.example/api/auth/sign-in/email", { method: "POST" })
    await customerFetcher("https://storefront.example/api/auth/status")
    await customerFetcher("https://storefront.example/api/v1/public/products")
    await customerFetcher("https://admin.example/api/auth/status")

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://storefront.example/api/auth/customer/sign-in/email",
      { method: "POST" },
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://storefront.example/api/auth/customer/status",
      undefined,
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://storefront.example/api/v1/public/products",
      undefined,
    )
    expect(fetcher).toHaveBeenNthCalledWith(4, "https://admin.example/api/auth/status", undefined)
  })
})
