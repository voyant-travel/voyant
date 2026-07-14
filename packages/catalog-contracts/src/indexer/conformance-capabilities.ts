import type { IndexerAdapter, IndexerSlice } from "./contract.js"

export interface IndexerCapabilityFixtureIds {
  alpha: string
  admin: string
  federationCustomer: string
  federationPartner: string
}

export async function assertVectorCapabilities(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: IndexerCapabilityFixtureIds,
): Promise<void> {
  if (!adapter.capabilities.supportsVectorFields) return
  const queryEmbedding = Array.from(
    { length: adapter.capabilities.vectorDimensions ?? 0 },
    () => 0.25,
  )
  const semantic = await adapter.search(slice, {
    query: "",
    mode: "semantic",
    query_embedding: queryEmbedding,
    pagination: { limit: 10 },
  })
  assertIds(
    semantic.hits.map((hit) => hit.id),
    [ids.alpha],
    "semantic vector search",
  )

  if (!adapter.capabilities.supportsHybridSearch) return
  const hybrid = await adapter.search(slice, {
    query: "Alpine",
    mode: "hybrid",
    query_embedding: queryEmbedding,
    pagination: { limit: 10 },
  })
  assertIds(
    hybrid.hits.map((hit) => hit.id),
    [ids.alpha],
    "hybrid search",
  )
}

export async function assertAdminDenormalization(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: IndexerCapabilityFixtureIds,
): Promise<void> {
  if (!adapter.capabilities.supportsAdminDenormalization) return
  const results = await adapter.search(slice, {
    query: "Customer Alias",
    mode: "keyword",
  })
  assertIds(
    results.hits.map((hit) => hit.id),
    [ids.admin],
    "admin denormalized keyword search",
  )
}

export async function assertCrossAudienceFederation(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: IndexerCapabilityFixtureIds,
): Promise<void> {
  if (!adapter.capabilities.supportsCrossAudienceFederation) return
  const results = await adapter.search(slice, {
    query: "Pool",
    mode: "keyword",
    search_audiences: ["customer", "partner"],
    pagination: { limit: 10 },
  })
  assertIds(
    results.hits.map((hit) => hit.id),
    [ids.federationCustomer, ids.federationPartner],
    "cross-audience federation",
  )
}

function assertIds(actual: string[], expected: string[], operation: string): void {
  const actualSorted = [...actual].sort()
  const expectedSorted = [...expected].sort()
  assert(
    JSON.stringify(actualSorted) === JSON.stringify(expectedSorted),
    `${operation} returned [${actualSorted.join(", ")}]; expected [${expectedSorted.join(", ")}]`,
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Indexer adapter conformance failed: ${message}`)
}
