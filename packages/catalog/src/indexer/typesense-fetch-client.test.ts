import { afterEach, describe, expect, it, vi } from "vitest"
import { createTypesenseIndexer } from "./typesense.js"
import { createTypesenseFetchClient } from "./typesense-fetch-client.js"

afterEach(() => vi.unstubAllGlobals())

describe("Typesense fetch client", () => {
  it("lists collections through the adapter admin surface", async () => {
    const fetch = vi.fn(async () =>
      Response.json([
        { name: "products__en-GB__customer__default", fields: [] },
        { name: "unrelated", fields: [] },
      ]),
    )
    vi.stubGlobal("fetch", fetch)
    const adapter = createTypesenseIndexer({
      client: createTypesenseFetchClient("https://search.example.test/", "secret-key"),
      registries: new Map(),
    })

    await expect(adapter.admin?.list()).resolves.toEqual([
      { vertical: "products", locale: "en-GB", audience: "customer", market: "default" },
    ])
    expect(fetch).toHaveBeenCalledWith(
      "https://search.example.test/collections",
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it("reports a missing collection as an idempotent drop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"Not Found"}', { status: 404 })),
    )
    const adapter = createTypesenseIndexer({
      client: createTypesenseFetchClient("https://search.example.test", "secret-key"),
      registries: new Map(),
    })

    await expect(
      adapter.admin?.drop({
        vertical: "products",
        locale: "en-GB",
        audience: "customer",
        market: "default",
      }),
    ).resolves.toBe(false)
  })
})
