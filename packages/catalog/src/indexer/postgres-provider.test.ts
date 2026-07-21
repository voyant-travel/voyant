import { describe, expect, it } from "vitest"

import { createPostgresGraphIndexerProvider } from "./postgres-provider.js"

const DATABASE_RESOURCE_ID = "@voyant-travel/catalog#resource.database"

describe("Postgres graph indexer provider", () => {
  it("binds the adapter to its declared deployment database resource", () => {
    const db = { execute: async () => [] }
    const provider = createPostgresGraphIndexerProvider({
      getResource: ((id: string) => (id === DATABASE_RESOURCE_ID ? db : undefined)) as never,
    })

    expect(provider.create({ registries: new Map() }).capabilities).toMatchObject({
      supportsKeywordSearch: true,
      supportsVectorFields: false,
      vectorDimensions: null,
    })
  })

  it("fails closed when the declared database resource was not supplied", () => {
    expect(() =>
      createPostgresGraphIndexerProvider({ getResource: (() => undefined) as never }),
    ).toThrow(DATABASE_RESOURCE_ID)
  })
})
