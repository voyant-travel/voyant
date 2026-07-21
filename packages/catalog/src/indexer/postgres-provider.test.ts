import { describe, expect, it } from "vitest"

import { createPostgresGraphIndexerProvider } from "./postgres-provider.js"

const DATABASE_RESOURCE_ID = "@voyant-travel/catalog#resource.database"
const VECTOR_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-vector-strategy"
const TYPO_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-typo-strategy"

describe("Postgres graph indexer provider", () => {
  it("binds the adapter to its declared deployment database resource", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
      getConfig: (() => undefined) as never,
    })

    expect(provider.create({ registries: new Map() }).capabilities).toMatchObject({
      supportsKeywordSearch: true,
      supportsVectorFields: false,
      vectorDimensions: null,
    })
  })

  it("fails closed when the declared database resource was not supplied", () => {
    expect(() =>
      createPostgresGraphIndexerProvider({
        getResource: (() => undefined) as never,
        getConfig: (() => undefined) as never,
      }),
    ).toThrow(DATABASE_RESOURCE_ID)
  })

  it("enables pgvector only from its recorded deployment capability", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
      getConfig: ((id: string) =>
        id === VECTOR_STRATEGY_CONFIG_ID ? "pgvector" : undefined) as never,
    })

    expect(
      provider.create({ registries: new Map(), vectorDimensions: 3 }).capabilities,
    ).toMatchObject({
      supportsHybridSearch: true,
      supportsVectorFields: true,
      vectorDimensions: 3,
      maxVectorsPerDocument: 1,
    })
  })

  it("rejects unrecorded Postgres vector strategies", () => {
    const db = { execute: async () => [] }
    expect(() =>
      createPostgresGraphIndexerProvider({
        getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
        getConfig: ((id: string) =>
          id === VECTOR_STRATEGY_CONFIG_ID ? "lakebase" : undefined) as never,
      }),
    ).toThrow("POSTGRES_SEARCH_VECTOR_STRATEGY")
  })

  it("rejects unrecorded Postgres typo strategies", () => {
    const db = { execute: async () => [] }
    expect(() =>
      createPostgresGraphIndexerProvider({
        getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
        getConfig: ((id: string) =>
          id === TYPO_STRATEGY_CONFIG_ID ? "lakebase" : undefined) as never,
      }),
    ).toThrow("POSTGRES_SEARCH_TYPO_STRATEGY")
  })
})
