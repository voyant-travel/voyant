import { describe, expect, it } from "vitest"

import { createTypesenseGraphIndexerProvider } from "./typesense-provider.js"

describe("Typesense graph indexer provider", () => {
  it("constructs an adapter from provider-owned credentials", () => {
    const provider = createTypesenseGraphIndexerProvider({
      getConfig: () => "https://search.example.test",
      getSecret: () => "secret-key",
    } as never)

    const adapter = provider.create({ registries: new Map(), vectorDimensions: 768 })

    expect(adapter.capabilities).toMatchObject({
      supportsKeywordSearch: true,
      supportsVectorFields: true,
      vectorDimensions: 768,
    })
    expect(adapter.admin).toBeDefined()
  })

  it("fails during provider setup when selected credentials are invalid", () => {
    expect(() =>
      createTypesenseGraphIndexerProvider({
        getConfig: () => "not-a-url",
        getSecret: () => "secret-key",
      } as never),
    ).toThrow("Invalid URL")
  })
})
