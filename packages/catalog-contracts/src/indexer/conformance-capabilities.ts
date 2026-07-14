import type { IndexerAdapter, IndexerSlice } from "./contract.js"

export interface IndexerCapabilityFixtureIds {
  alpha: string
  admin: string
  federationCustomer: string
  federationPartner: string
}

export function createConformanceEmbedding(
  id: string,
  ids: IndexerCapabilityFixtureIds,
  dimensions: number,
): number[] {
  const embedding = Array.from({ length: dimensions }, () => 0)
  if (id === ids.alpha) embedding[0] = 1
  else if (id === ids.bravo) embedding[0] = -1
  else if (dimensions > 1) embedding[1] = 1
  else embedding[0] = -1
  return embedding
}

export async function assertVectorCapabilities(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: IndexerCapabilityFixtureIds,
): Promise<void> {
  if (!adapter.capabilities.supportsVectorFields) return
  const queryEmbedding = Array.from(
    { length: adapter.capabilities.vectorDimensions ?? 0 },
    (_, index) => (index === 0 ? 1 : 0),
  )
  const semantic = await adapter.search(slice, {
    query: "",
    mode: "semantic",
    query_embedding: queryEmbedding,
    pagination: { limit: 10 },
  })
  assertLeadingId(
    semantic.hits.map((hit) => hit.id),
    ids.alpha,
    "semantic vector search",
  )

  if (!adapter.capabilities.supportsHybridSearch) return
  const keywordWeighted = await adapter.search(slice, {
    query: "Coastal",
    mode: "hybrid",
    query_embedding: queryEmbedding,
    alpha: 0.25,
    pagination: { limit: 10 },
  })
  assertLeadingId(
    keywordWeighted.hits.map((hit) => hit.id),
    ids.bravo,
    "keyword-weighted hybrid search",
  )

  const vectorWeighted = await adapter.search(slice, {
    query: "Coastal",
    mode: "hybrid",
    query_embedding: queryEmbedding,
    alpha: 0.75,
    pagination: { limit: 10 },
  })
  assertLeadingId(
    vectorWeighted.hits.map((hit) => hit.id),
    ids.alpha,
    "vector-weighted hybrid search",
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

function assertLeadingId(actual: string[], expected: string, operation: string): void {
  assert(
    actual[0] === expected,
    `${operation} ranked ${actual[0] ?? "no document"} first; expected ${expected}`,
  )
  assert(actual.length > 1, `${operation} did not include competing vector candidates`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Indexer adapter conformance failed: ${message}`)
}
