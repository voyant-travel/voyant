import type { SourceAdapter } from "@voyantjs/catalog"
import { beforeEach, describe, expect, it, vi } from "vitest"

const catalogMocks = vi.hoisted(() => ({
  createInvalidateOnDrift: vi.fn(() => vi.fn()),
  fetchOverlaysForEntity: vi.fn(async () => []),
  isStale: vi.fn(() => false),
  mergeOverlaysIntoContent: vi.fn((payload: unknown) => payload),
  pickBestCachedLocale: vi.fn(() => null),
  readSourcedEntry: vi.fn(),
  withContentRefreshLock: vi.fn(async (_db: unknown, _key: unknown, fn: () => unknown) => fn()),
}))

vi.mock("@voyantjs/catalog", () => catalogMocks)

import { PRODUCTS_CONTENT_SCHEMA_VERSION } from "../../src/content-shape.js"
import { getProductContent } from "../../src/service-content.js"

function makeProductContent(name: string) {
  return {
    product: {
      id: "prod_1",
      name,
    },
    options: [],
    days: [],
    media: [],
    policies: [],
    departures: [],
  }
}

function makeSourcedEntry() {
  const now = new Date("2026-01-01T00:00:00Z")
  return {
    id: "cse_1",
    entity_module: "products",
    entity_id: "prod_1",
    source_kind: "direct:test",
    source_provider: "test",
    source_connection_id: "conn_1",
    source_ref: "upstream_prod_1",
    source_freshness: "sync",
    last_sourced_at: now,
    status: "active",
    projection: { fields: { name: "Projected product" } },
    projection_etag: "projection-etag",
    projection_seen_at: now,
    first_seen_at: now,
    last_seen_at: now,
  }
}

function makeDb() {
  const where = vi.fn(async () => [])
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))

  const onConflictDoUpdate = vi.fn(async () => undefined)
  const values = vi.fn(() => ({ onConflictDoUpdate }))
  const insert = vi.fn(() => ({ values }))

  return {
    db: { select, insert },
    insert,
    select,
    values,
    onConflictDoUpdate,
  }
}

function makeAdapter(ownsContentCache: boolean): SourceAdapter {
  return {
    kind: "direct:test",
    capabilities: {
      verticals: ["products"],
      supportsLiveResolution: true,
      supportsDriftDetection: true,
      supportsBookingForwarding: false,
      postBookOperations: [],
      supportsContentFetch: true,
      ownsContentCache,
    },
    getContent: vi.fn(async (_ctx, request) => ({
      entity_module: request.entity_module,
      entity_id: request.entity_id,
      source_ref: "upstream_prod_1",
      returned_locale: request.locale,
      content: makeProductContent(`Fresh ${request.locale}`),
      content_schema_version: PRODUCTS_CONTENT_SCHEMA_VERSION,
    })),
  }
}

function makeRegistry(adapter: SourceAdapter) {
  return {
    resolveByConnection: vi.fn(() => adapter),
    byKind: vi.fn(() => [{ adapter }]),
  }
}

describe("getProductContent cache ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    catalogMocks.fetchOverlaysForEntity.mockResolvedValue([])
    catalogMocks.pickBestCachedLocale.mockReturnValue(null)
    catalogMocks.readSourcedEntry.mockResolvedValue(makeSourcedEntry())
    catalogMocks.withContentRefreshLock.mockImplementation(
      async (_db: unknown, _key: unknown, fn: () => unknown) => fn(),
    )
  })

  it("passes through every read and skips sourced-content cache storage when the adapter owns content cache", async () => {
    const db = makeDb()
    const adapter = makeAdapter(true)

    const first = await getProductContent(
      // biome-ignore lint/suspicious/noExplicitAny: this unit test stubs only the db calls used here. -- owner: products; existing suppression is intentional pending typed cleanup.
      db.db as any,
      "prod_1",
      { preferredLocales: ["en-GB"], market: "GB" },
      { registry: makeRegistry(adapter) },
    )
    const second = await getProductContent(
      // biome-ignore lint/suspicious/noExplicitAny: this unit test stubs only the db calls used here. -- owner: products; existing suppression is intentional pending typed cleanup.
      db.db as any,
      "prod_1",
      { preferredLocales: ["en-GB"], market: "GB" },
      { registry: makeRegistry(adapter) },
    )

    expect(adapter.getContent).toHaveBeenCalledTimes(2)
    expect(db.select).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(catalogMocks.withContentRefreshLock).not.toHaveBeenCalled()
    expect(first?.source).toBe("sourced-fresh")
    expect(second?.source).toBe("sourced-fresh")
  })

  it("preserves catalog-owned cache write-through by default", async () => {
    const db = makeDb()
    const adapter = makeAdapter(false)

    const result = await getProductContent(
      // biome-ignore lint/suspicious/noExplicitAny: this unit test stubs only the db calls used here. -- owner: products; existing suppression is intentional pending typed cleanup.
      db.db as any,
      "prod_1",
      { preferredLocales: ["en-GB"], market: "GB" },
      { registry: makeRegistry(adapter) },
    )

    expect(db.select).toHaveBeenCalledTimes(1)
    expect(catalogMocks.withContentRefreshLock).toHaveBeenCalledTimes(1)
    expect(adapter.getContent).toHaveBeenCalledTimes(1)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: "prod_1",
        locale: "en-GB",
        market: "GB",
        content_schema_version: PRODUCTS_CONTENT_SCHEMA_VERSION,
      }),
    )
    expect(db.onConflictDoUpdate).toHaveBeenCalledTimes(1)
    expect(result?.source).toBe("sourced-fresh")
  })

  it("fails fast when content-cache ownership is declared without getContent", async () => {
    const db = makeDb()
    const adapter = makeAdapter(true)
    delete adapter.getContent

    await expect(
      getProductContent(
        // biome-ignore lint/suspicious/noExplicitAny: this unit test stubs only the db calls used here. -- owner: products; existing suppression is intentional pending typed cleanup.
        db.db as any,
        "prod_1",
        { preferredLocales: ["en-GB"], market: "GB" },
        { registry: makeRegistry(adapter) },
      ),
    ).rejects.toThrow(/ownsContentCache/)

    expect(db.select).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })
})
