import {
  createFieldPolicyRegistry,
  type FieldPolicy,
  type FieldPolicyRegistry,
  type Visibility,
} from "../contract.js"
import {
  assertAdminDenormalization,
  assertCrossAudienceFederation,
  assertVectorCapabilities,
  createConformanceEmbedding,
  type IndexerCapabilityFixtureIds,
} from "./conformance-capabilities.js"
import type {
  IndexerAdapter,
  IndexerAdmin,
  IndexerDocument,
  IndexerSlice,
  SearchFilter,
  SearchRequest,
} from "./contract.js"

export type IndexerConformanceMutation = "ensure" | "upsert" | "delete" | "bulk-reindex" | "drop"

export interface IndexerAdapterConformanceOptions {
  createAdapter: () => IndexerAdapter | Promise<IndexerAdapter>
  /** Override the primary fixture slice when a provider constrains slice names. */
  slice?: IndexerSlice
  /** Override the standard fixture registry. */
  registry?: FieldPolicyRegistry
  /** Stable prefix for provider resources and document ids. */
  namespace?: string
  /** Wait for hosted engines to make a mutation visible to subsequent reads. */
  settle?: (mutation: IndexerConformanceMutation, adapter: IndexerAdapter) => void | Promise<void>
}

/** Registry used by the published indexer conformance fixtures. */
export function createIndexerConformanceRegistry(): FieldPolicyRegistry {
  return createFieldPolicyRegistry([
    fixturePolicy("title", "merchandisable", "entry"),
    fixturePolicy("categorySlugs[]", "structural", "facet-affecting"),
    fixturePolicy("priceFromAmountCents", "structural", "entry"),
    fixturePolicy("isFeatured", "structural", "entry"),
    fixturePolicy("customerTitle", "merchandisable", "entry", ["customer"]),
  ])
}

/**
 * Exercise the portable adapter behavior without depending on a test runner.
 * The runner cleans up documents, and drops fixture slices when admin support
 * is present.
 */
export async function assertIndexerAdapterConformance(
  options: IndexerAdapterConformanceOptions,
): Promise<void> {
  const adapter = await options.createAdapter()
  const namespace = options.namespace ?? randomNamespace()
  const registry = options.registry ?? createIndexerConformanceRegistry()
  const primary = options.slice ?? defaultSlice(namespace)
  const isolated: IndexerSlice = { ...primary, market: `${primary.market}-isolated` }
  const bulk: IndexerSlice = { ...primary, market: `${primary.market}-bulk` }
  const adminDenormalized: IndexerSlice = {
    ...primary,
    audience: "staff-admin",
    market: `${primary.market}-admin-denormalized`,
  }
  const federationBase: IndexerSlice = {
    ...primary,
    audience: "staff-admin",
    market: `${primary.market}-federated`,
  }
  const federationCustomer: IndexerSlice = { ...federationBase, audience: "customer" }
  const federationPartner: IndexerSlice = { ...federationBase, audience: "partner" }
  const slices = [
    primary,
    isolated,
    bulk,
    ...(adapter.capabilities.supportsAdminDenormalization ? [adminDenormalized] : []),
    ...(adapter.capabilities.supportsCrossAudienceFederation
      ? [federationBase, federationCustomer, federationPartner]
      : []),
  ]
  const ids = fixtureIds(namespace)
  const documents = fixtureDocuments(ids, adapter.capabilities.vectorDimensions)
  const keywordOnlyDocument = fixtureKeywordOnlyDocument(ids.keywordOnly)
  const admin = adapter.admin
  const settle = async (mutation: IndexerConformanceMutation): Promise<void> => {
    await options.settle?.(mutation, adapter)
  }

  assertCapabilities(adapter)

  try {
    for (const slice of slices) {
      await adapter.ensureCollection(slice, registry)
    }
    await settle("ensure")

    await adapter.upsert(primary, documents)
    await adapter.upsert(isolated, [
      {
        id: ids.isolated,
        fields: {
          title: "Voyant Isolated Escape",
          categorySlugs: ["isolated"],
          priceFromAmountCents: 400,
          isFeatured: false,
        },
      },
    ])
    if (adapter.capabilities.supportsAdminDenormalization) {
      await adapter.upsert(adminDenormalized, [
        {
          id: ids.admin,
          fields: {
            title: "Voyant Staff Record",
            customerTitle: "Voyant Customer Alias",
            categorySlugs: ["admin"],
            priceFromAmountCents: 500,
            isFeatured: false,
          },
        },
      ])
    }
    if (adapter.capabilities.supportsCrossAudienceFederation) {
      await adapter.upsert(federationCustomer, [
        fixtureAudienceDocument(ids.federationCustomer, "Voyant Customer Pool"),
      ])
      await adapter.upsert(federationPartner, [
        fixtureAudienceDocument(ids.federationPartner, "Voyant Partner Pool"),
      ])
    }
    await settle("upsert")

    const alphaDocument = documents.find((document) => document.id === ids.alpha)!
    await assertKeywordSearchAndHitFidelity(adapter, primary, ids, alphaDocument)
    if (adapter.capabilities.supportsHybridSearch) {
      await adapter.upsert(primary, [keywordOnlyDocument])
      await settle("upsert")
    }
    await assertVectorCapabilities(adapter, primary, ids)
    if (adapter.capabilities.supportsHybridSearch) {
      await adapter.delete(primary, [ids.keywordOnly])
      await settle("delete")
    }
    await assertAdminDenormalization(adapter, adminDenormalized, ids)
    await assertCrossAudienceFederation(adapter, federationBase, ids)
    await assertFilters(adapter, primary, ids)
    await assertSliceIsolation(adapter, primary, isolated, ids)
    await assertPagination(adapter, primary, ids)
    await assertFacets(adapter, primary)
    await assertInvalidFacetLimits(adapter, primary)
    await assertUpsertReplacement(adapter, primary, ids, alphaDocument, settle)

    await adapter.bulkReindex(bulk, toAsyncIterable(documents.slice(0, 2)))
    await settle("bulk-reindex")
    assertIds(await searchAll(adapter, bulk), [ids.charlie, ids.bravo], "bulk reindex")

    if (admin) {
      await assertAdmin(admin, slices, primary, bulk, documents, settle)
    }

    await adapter.delete(primary, [ids.charlie])
    await settle("delete")
    assertIds(await searchAll(adapter, primary), [ids.alpha, ids.bravo], "delete")
  } finally {
    if (admin) {
      for (const slice of slices) await admin.drop(slice)
      await settle("drop")
    } else {
      const cleanupIds = Object.values(ids)
      for (const slice of slices) await adapter.delete(slice, cleanupIds)
      await settle("delete")
    }
  }
}

function fixturePolicy(
  path: string,
  fieldClass: FieldPolicy["class"],
  reindex: FieldPolicy["reindex"],
  visibility: Visibility[] = ["staff", "customer", "partner", "supplier"],
): FieldPolicy {
  return {
    path,
    class: fieldClass,
    merge: "replace",
    drift: "low",
    reindex,
    snapshot: "never",
    query: "indexed-column",
    localized: false,
    visibility,
    editRole: "none",
    overrideFriction: "none",
    sourceFreshness: "sync",
  }
}

function fixtureAudienceDocument(id: string, title: string): IndexerDocument {
  return {
    id,
    fields: {
      title,
      categorySlugs: ["federated"],
      priceFromAmountCents: 600,
      isFeatured: false,
    },
  }
}

function assertCapabilities(adapter: IndexerAdapter): void {
  const capabilities = adapter.capabilities
  const booleanCapabilities = [
    "supportsKeywordSearch",
    "supportsHybridSearch",
    "supportsVectorFields",
    "supportsCrossAudienceFederation",
    "supportsAdminDenormalization",
  ] as const
  for (const name of booleanCapabilities) {
    assert(typeof capabilities[name] === "boolean", `${name} must be a boolean`)
  }
  assert(capabilities.supportsKeywordSearch, "supportsKeywordSearch must be true")
  if (capabilities.supportsVectorFields) {
    assert(
      Number.isInteger(capabilities.vectorDimensions) && (capabilities.vectorDimensions ?? 0) > 0,
      "vectorDimensions must be a positive integer when vector fields are supported",
    )
  } else {
    assert(
      capabilities.vectorDimensions === null,
      "vectorDimensions must be null when vector fields are unsupported",
    )
  }
  if (capabilities.supportsHybridSearch) {
    assert(
      capabilities.supportsKeywordSearch && capabilities.supportsVectorFields,
      "hybrid search requires keyword search and vector fields",
    )
  }
  assert(
    capabilities.maxVectorsPerDocument === null ||
      (Number.isInteger(capabilities.maxVectorsPerDocument) &&
        capabilities.maxVectorsPerDocument > 0),
    "maxVectorsPerDocument must be null or a positive integer",
  )
  if (!capabilities.supportsVectorFields) {
    assert(
      capabilities.maxVectorsPerDocument === null,
      "maxVectorsPerDocument must be null when vector fields are unsupported",
    )
  }
}

async function assertKeywordSearchAndHitFidelity(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: FixtureIds,
  expectedDocument: IndexerDocument,
): Promise<void> {
  const results = await adapter.search(slice, keywordRequest({ query: "Alpine" }))
  assertIds(
    results.hits.map((hit) => hit.id),
    [ids.alpha],
    "non-empty keyword search",
  )
  assert(results.total === 1, `keyword search total was ${results.total}; expected 1`)
  const hit = results.hits[0]
  assert(hit?.id === hit?.document.id, "search hit id did not match its document id")
  assert(Number.isFinite(hit?.score), "search hit score was not finite")
  assert(
    structurallyEqual(hit?.document.fields, expectedDocument.fields),
    "search hit did not preserve the indexed document fields",
  )
}

async function assertFilters(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: FixtureIds,
): Promise<void> {
  const cases: Array<{ name: string; filters: SearchFilter[]; expected: string[] }> = [
    {
      name: "document id filter",
      filters: [{ kind: "in", field: "id", values: [ids.bravo] }],
      expected: [ids.bravo],
    },
    {
      name: "equality filter",
      filters: [{ kind: "eq", field: "isFeatured", value: true }],
      expected: [ids.alpha, ids.charlie],
    },
    {
      name: "set-membership filter",
      filters: [{ kind: "in", field: "categorySlugs", values: ["beach", "city"] }],
      expected: [ids.bravo, ids.charlie],
    },
    {
      name: "range filter",
      filters: [{ kind: "range", field: "priceFromAmountCents", gte: 150, lte: 250 }],
      expected: [ids.charlie],
    },
    {
      name: "and filter",
      filters: [
        {
          kind: "and",
          clauses: [
            { kind: "eq", field: "isFeatured", value: true },
            { kind: "range", field: "priceFromAmountCents", gte: 250 },
          ],
        },
      ],
      expected: [ids.alpha],
    },
    {
      name: "or filter",
      filters: [
        {
          kind: "or",
          clauses: [
            { kind: "eq", field: "isFeatured", value: false },
            { kind: "range", field: "priceFromAmountCents", lte: 100 },
          ],
        },
      ],
      expected: [ids.bravo],
    },
  ]

  for (const testCase of cases) {
    const results = await adapter.search(slice, keywordRequest({ filters: testCase.filters }))
    assertIds(
      results.hits.map((hit) => hit.id),
      testCase.expected,
      testCase.name,
    )
  }
}

async function assertSliceIsolation(
  adapter: IndexerAdapter,
  primary: IndexerSlice,
  isolated: IndexerSlice,
  ids: FixtureIds,
): Promise<void> {
  assert(
    !(await searchAll(adapter, primary)).includes(ids.isolated),
    "primary slice returned a document from another slice",
  )
  assertIds(await searchAll(adapter, isolated), [ids.isolated], "slice isolation")
}

async function assertPagination(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: FixtureIds,
): Promise<void> {
  const first = await adapter.search(
    slice,
    keywordRequest({ sort: "price-asc", pagination: { limit: 2 } }),
  )
  assertOrderedIds(
    first.hits.map((hit) => hit.id),
    [ids.bravo, ids.charlie],
    "first page",
  )
  assert(first.total === 3, `pagination total was ${first.total}; expected 3`)
  assert(Boolean(first.next_cursor), "first page did not return next_cursor")

  const second = await adapter.search(
    slice,
    keywordRequest({
      sort: "price-asc",
      pagination: { limit: 2, cursor: first.next_cursor },
    }),
  )
  assertOrderedIds(
    second.hits.map((hit) => hit.id),
    [ids.alpha],
    "second page",
  )
  assert(second.total === 3, `terminal pagination total was ${second.total}; expected 3`)
  assert(!second.next_cursor, "terminal page returned next_cursor")
}

async function assertFacets(adapter: IndexerAdapter, slice: IndexerSlice): Promise<void> {
  const results = await adapter.search(
    slice,
    keywordRequest({ facets: [{ field: "categorySlugs", limit: 2 }], pagination: { limit: 1 } }),
  )
  assert(results.hits.length === 1, "search result ignored pagination limit")
  const buckets = results.facets?.categorySlugs
  assert(buckets, "categorySlugs facet was omitted")
  assert(buckets.length === 2, `facet returned ${buckets.length} buckets; expected exactly 2`)
  const featured = buckets.find((bucket) => bucket.value === "featured")
  const ski = buckets.find((bucket) => bucket.value === "ski")
  assert(featured?.count === 2, "featured facet count was not 2")
  assert(ski?.count === 2, "ski facet count was not 2")
}

async function assertInvalidFacetLimits(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
): Promise<void> {
  for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
    let rejected = false
    try {
      await adapter.search(slice, keywordRequest({ facets: [{ field: "categorySlugs", limit }] }))
    } catch {
      rejected = true
    }
    assert(rejected, `facet limit ${String(limit)} was not rejected`)
  }
}

async function assertUpsertReplacement(
  adapter: IndexerAdapter,
  slice: IndexerSlice,
  ids: FixtureIds,
  original: IndexerDocument,
  settle: (mutation: IndexerConformanceMutation) => Promise<void>,
): Promise<void> {
  const replacement: IndexerDocument = {
    ...original,
    fields: { ...original.fields, title: "Voyant Mountain Replacement" },
  }
  await adapter.upsert(slice, [replacement])
  await settle("upsert")

  const results = await adapter.search(slice, keywordRequest({ query: "Replacement" }))
  assertIds(
    results.hits.map((hit) => hit.id),
    [ids.alpha],
    "upsert replacement",
  )
  assert(results.total === 1, `upsert replacement total was ${results.total}; expected 1`)
  assert(
    results.hits[0]?.document.fields.title === "Voyant Mountain Replacement",
    "upsert replacement returned stale document fields",
  )
  assert((await searchAll(adapter, slice)).length === 3, "upsert replacement duplicated a document")

  await adapter.upsert(slice, [original])
  await settle("upsert")
}

async function assertAdmin(
  admin: IndexerAdmin,
  slices: IndexerSlice[],
  primary: IndexerSlice,
  bulk: IndexerSlice,
  expectedDocuments: IndexerDocument[],
  settle: (mutation: IndexerConformanceMutation) => Promise<void>,
): Promise<void> {
  const listed = await admin.list()
  for (const slice of slices) {
    assert(
      listed.some((candidate) => sameSlice(candidate, slice)),
      "admin list omitted a slice",
    )
  }

  const scanned: IndexerDocument[] = []
  for await (const document of admin.scan(primary, { batchSize: 1 })) {
    scanned.push(document)
  }
  assertIds(
    scanned.map((document) => document.id),
    expectedDocuments.map((document) => document.id),
    "admin scan",
  )
  const expectedAlpha = expectedDocuments.find(
    (document) => document.fields.title === "Voyant Alpine Escape",
  )
  const alpha = scanned.find((document) => document.id === expectedAlpha?.id)
  assert(alpha?.fields.title === "Voyant Alpine Escape", "admin scan omitted document fields")
  assert(!Object.hasOwn(alpha?.fields ?? {}, "id"), "admin scan leaked id into document fields")
  for (const expected of expectedDocuments.filter((document) => document.embeddings)) {
    const actual = scanned.find((document) => document.id === expected.id)
    assert(
      structurallyEqual(actual?.embeddings, expected.embeddings),
      `admin scan did not preserve the exact embedding for ${expected.id}`,
    )
    assert(
      actual?.embedding_model_id === expected.embedding_model_id,
      `admin scan did not preserve the embedding model id for ${expected.id}`,
    )
  }

  assert(await admin.drop(bulk), "admin drop returned false for an existing slice")
  await settle("drop")
  assert(!(await admin.list()).some((slice) => sameSlice(slice, bulk)), "dropped slice listed")
  assert(!(await admin.drop(bulk)), "admin drop returned true for a missing slice")
}

function keywordRequest(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return { query: "", mode: "keyword", ...overrides }
}

async function searchAll(adapter: IndexerAdapter, slice: IndexerSlice): Promise<string[]> {
  const results = await adapter.search(slice, keywordRequest({ pagination: { limit: 100 } }))
  return results.hits.map((hit) => hit.id)
}

function fixtureDocuments(ids: FixtureIds, vectorDimensions: number | null): IndexerDocument[] {
  const documents: IndexerDocument[] = [
    {
      id: ids.charlie,
      fields: {
        title: "Voyant City Break",
        categorySlugs: ["city", "featured"],
        priceFromAmountCents: 200,
        isFeatured: true,
      },
    },
    {
      id: ids.bravo,
      fields: {
        title: "Voyant Coastal Escape",
        categorySlugs: ["beach", "ski"],
        priceFromAmountCents: 100,
        isFeatured: false,
      },
    },
    {
      id: ids.alpha,
      fields: {
        title: "Voyant Alpine Escape",
        categorySlugs: ["ski", "featured"],
        priceFromAmountCents: 300,
        isFeatured: true,
      },
    },
  ]
  if (vectorDimensions) {
    for (const document of documents) {
      document.embeddings = {
        text_embedding: createConformanceEmbedding(document.id, ids, vectorDimensions),
      }
      document.embedding_model_id = "conformance-model"
    }
  }
  return documents
}

function fixtureKeywordOnlyDocument(id: string): IndexerDocument {
  return {
    id,
    fields: {
      title: "Voyant Keyword Signal",
      categorySlugs: ["keyword-only"],
      priceFromAmountCents: 250,
      isFeatured: false,
    },
  }
}

interface FixtureIds extends IndexerCapabilityFixtureIds {
  alpha: string
  bravo: string
  charlie: string
  isolated: string
  admin: string
  federationCustomer: string
  federationPartner: string
}

function fixtureIds(namespace: string): FixtureIds {
  return {
    alpha: `${namespace}-alpha`,
    bravo: `${namespace}-bravo`,
    keywordOnly: `${namespace}-keyword-only`,
    charlie: `${namespace}-charlie`,
    isolated: `${namespace}-isolated`,
    admin: `${namespace}-admin`,
    federationCustomer: `${namespace}-federation-customer`,
    federationPartner: `${namespace}-federation-partner`,
  }
}

function defaultSlice(namespace: string): IndexerSlice {
  return {
    vertical: namespace,
    locale: "en-GB",
    audience: "customer",
    market: "default",
  }
}

function randomNamespace(): string {
  return `conformance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function* toAsyncIterable(documents: IndexerDocument[]): AsyncIterable<IndexerDocument> {
  yield* documents
}

function sameSlice(left: IndexerSlice, right: IndexerSlice): boolean {
  return (
    left.vertical === right.vertical &&
    left.locale === right.locale &&
    left.audience === right.audience &&
    left.market === right.market &&
    left.channel === right.channel
  )
}

function assertIds(actual: string[], expected: string[], operation: string): void {
  const actualSorted = [...actual].sort()
  const expectedSorted = [...expected].sort()
  assert(
    structurallyEqual(actualSorted, expectedSorted),
    `${operation} returned [${actualSorted.join(", ")}]; expected [${expectedSorted.join(", ")}]`,
  )
}

function assertOrderedIds(actual: string[], expected: string[], operation: string): void {
  assert(
    structurallyEqual(actual, expected),
    `${operation} returned [${actual.join(", ")}]; expected ordered [${expected.join(", ")}]`,
  )
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    )
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort()
  const rightKeys = Object.keys(rightRecord).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && structurallyEqual(leftRecord[key], rightRecord[key]),
    )
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Indexer adapter conformance failed: ${message}`)
}
