import { describe, expect, it } from "vitest"

import { createPostgresIndexer } from "./postgres.js"
import { createPostgresGraphIndexerProvider } from "./postgres-provider.js"

const DATABASE_RESOURCE_ID = "@voyant-travel/catalog#resource.database"
const VECTOR_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-vector-strategy"
const TYPO_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-typo-strategy"
const TEXT_STRATEGY_CONFIG_ID = "@voyant-travel/catalog#config.postgres-search-text-strategy"
const CURSOR_SIGNING_KEY_SECRET_ID =
  "@voyant-travel/catalog#secret.postgres-search-cursor-signing-key"
const CURSOR_SIGNING_KEY = "test-postgres-cursor-signing-key"

describe("Postgres graph indexer provider", () => {
  it("binds the adapter to its declared deployment database resource", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
      getConfig: (() => undefined) as never,
      getSecret: ((id: string) =>
        id === CURSOR_SIGNING_KEY_SECRET_ID ? CURSOR_SIGNING_KEY : undefined) as never,
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
        getSecret: (() => undefined) as never,
      }),
    ).toThrow(DATABASE_RESOURCE_ID)
  })

  it("enables pgvector only from its recorded deployment capability", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
      getConfig: ((id: string) =>
        id === VECTOR_STRATEGY_CONFIG_ID ? "pgvector" : undefined) as never,
      getSecret: ((id: string) =>
        id === CURSOR_SIGNING_KEY_SECRET_ID ? CURSOR_SIGNING_KEY : undefined) as never,
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

  it("enables Lakebase ANN only from its recorded deployment capability", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
      getConfig: ((id: string) =>
        id === VECTOR_STRATEGY_CONFIG_ID ? "lakebase" : undefined) as never,
      getSecret: ((id: string) =>
        id === CURSOR_SIGNING_KEY_SECRET_ID ? CURSOR_SIGNING_KEY : undefined) as never,
    })
    expect(
      provider.create({ registries: new Map(), vectorDimensions: 3 }).capabilities,
    ).toMatchObject({
      supportsHybridSearch: true,
      supportsVectorFields: true,
      vectorDimensions: 3,
    })
  })

  it("reports the recorded Lakebase capability state without a query-time probe", () => {
    const adapter = createPostgresIndexer({
      db: { execute: async () => [] } as never,
      registries: new Map(),
      vectorDimensions: 3,
      vectorStrategy: "lakebase",
      textStrategy: "lakebase",
    })

    expect(adapter.diagnostics()).toMatchObject({
      textStrategy: "lakebase",
      vectorStrategy: "lakebase",
      vectorDimensions: 3,
    })
  })

  it("rejects unrecorded Postgres typo strategies", () => {
    const db = { execute: async () => [] }
    expect(() =>
      createPostgresGraphIndexerProvider({
        getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
        getConfig: ((id: string) =>
          id === TYPO_STRATEGY_CONFIG_ID ? "lakebase" : undefined) as never,
        getSecret: ((id: string) =>
          id === CURSOR_SIGNING_KEY_SECRET_ID ? CURSOR_SIGNING_KEY : undefined) as never,
      }),
    ).toThrow("POSTGRES_SEARCH_TYPO_STRATEGY")
  })

  it("accepts Lakebase text only when recorded by the deployment", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
      getConfig: ((id: string) =>
        id === TEXT_STRATEGY_CONFIG_ID ? "lakebase" : undefined) as never,
      getSecret: ((id: string) =>
        id === CURSOR_SIGNING_KEY_SECRET_ID ? CURSOR_SIGNING_KEY : undefined) as never,
    })

    expect(provider.create({ registries: new Map() }).diagnostics()).toMatchObject({
      textStrategy: "lakebase",
    })
  })

  it("rejects unrecorded Postgres text strategies", () => {
    const db = { execute: async () => [] }
    expect(() =>
      createPostgresGraphIndexerProvider({
        getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
        getConfig: ((id: string) => (id === TEXT_STRATEGY_CONFIG_ID ? "bm25" : undefined)) as never,
        getSecret: ((id: string) =>
          id === CURSOR_SIGNING_KEY_SECRET_ID ? CURSOR_SIGNING_KEY : undefined) as never,
      }),
    ).toThrow("POSTGRES_SEARCH_TEXT_STRATEGY")
  })

  it("requires a deployment cursor-signing key", () => {
    const db = { execute: async () => [] }
    expect(() =>
      createPostgresGraphIndexerProvider({
        getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
        getConfig: (() => undefined) as never,
        getSecret: (() => undefined) as never,
      }),
    ).toThrow("POSTGRES_SEARCH_CURSOR_SIGNING_KEY")
  })
})
