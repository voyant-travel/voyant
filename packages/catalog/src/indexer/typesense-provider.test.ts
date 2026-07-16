import { describe, expect, it, vi } from "vitest"

import { createTypesenseIndexer } from "./typesense.js"
import { createTypesenseGraphIndexerProvider } from "./typesense-provider.js"

vi.mock("./typesense.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./typesense.js")>()
  return { ...actual, createTypesenseIndexer: vi.fn(actual.createTypesenseIndexer) }
})

const HOST_CONFIG_ID = "@voyant-travel/catalog#config.typesense-host"
const PREFIX_CONFIG_ID = "@voyant-travel/catalog#config.typesense-collection-prefix"

function configOf(values: Record<string, string | undefined>) {
  return (<T>(declarationId: string) => values[declarationId] as T | undefined) as never
}

describe("Typesense graph indexer provider", () => {
  it("constructs an adapter from provider-owned credentials", () => {
    const provider = createTypesenseGraphIndexerProvider({
      getConfig: configOf({ [HOST_CONFIG_ID]: "https://search.example.test" }),
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

  it("passes the optional collection prefix through to the indexer", () => {
    const provider = createTypesenseGraphIndexerProvider({
      getConfig: configOf({
        [HOST_CONFIG_ID]: "https://search.example.test",
        [PREFIX_CONFIG_ID]: "acme-prod",
      }),
      getSecret: () => "secret-key",
    } as never)

    provider.create({ registries: new Map(), vectorDimensions: 768 })

    const lastCall = vi.mocked(createTypesenseIndexer).mock.calls.at(-1)
    expect(lastCall?.[0]).toMatchObject({ collectionPrefix: "acme-prod" })
  })

  it("omits the collection prefix when the config is absent or blank", () => {
    const provider = createTypesenseGraphIndexerProvider({
      getConfig: configOf({
        [HOST_CONFIG_ID]: "https://search.example.test",
        [PREFIX_CONFIG_ID]: "  ",
      }),
      getSecret: () => "secret-key",
    } as never)

    provider.create({ registries: new Map(), vectorDimensions: 768 })

    const lastCall = vi.mocked(createTypesenseIndexer).mock.calls.at(-1)
    expect(lastCall?.[0]).not.toHaveProperty("collectionPrefix")
  })

  it("fails during provider setup when selected credentials are invalid", () => {
    expect(() =>
      createTypesenseGraphIndexerProvider({
        getConfig: configOf({ [HOST_CONFIG_ID]: "not-a-url" }),
        getSecret: () => "secret-key",
      } as never),
    ).toThrow("Invalid URL")
  })
})
