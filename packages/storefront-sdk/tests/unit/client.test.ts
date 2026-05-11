import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  storefrontFetchWithValidation,
  type VoyantStorefrontApiError,
  withStorefrontQueryParams,
} from "../../src/index.js"

describe("withStorefrontQueryParams", () => {
  it("serializes scalar and repeated query parameters", () => {
    expect(
      withStorefrontQueryParams("/v1/public/products/prod_123/departures", {
        locale: "en",
        tags: ["family", "summer"],
        offset: 0,
        empty: null,
      }),
    ).toBe("/v1/public/products/prod_123/departures?locale=en&tags=family&tags=summer&offset=0")
  })
})

describe("storefrontFetchWithValidation", () => {
  it("validates successful responses", async () => {
    const result = await storefrontFetchWithValidation(
      "/v1/public/settings",
      z.object({ data: z.object({ ok: z.boolean() }) }),
      {
        baseUrl: "https://example.com/",
        fetcher: async (url) => {
          expect(url).toBe("https://example.com/v1/public/settings")
          return Response.json({ data: { ok: true } })
        },
      },
    )

    expect(result.data.ok).toBe(true)
  })

  it("throws a typed API error for non-ok responses", async () => {
    await expect(
      storefrontFetchWithValidation("/v1/public/settings", z.unknown(), {
        baseUrl: "https://example.com",
        fetcher: async () => Response.json({ error: "No settings" }, { status: 404 }),
      }),
    ).rejects.toMatchObject({
      name: "VoyantStorefrontApiError",
      status: 404,
      message: "No settings",
    } satisfies Partial<VoyantStorefrontApiError>)
  })
})
