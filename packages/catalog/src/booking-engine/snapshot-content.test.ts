import { describe, expect, it, vi } from "vitest"

import type { GetContentRequest, GetContentResult, SourceAdapter } from "../adapter/contract.js"

import { SnapshotContentUnavailableError } from "./errors.js"
import { createSourceAdapterRegistry } from "./registry.js"
import {
  type ContentSnapshotAdapter,
  composeSnapshotContentCapturer,
  type SnapshotContentCaptureInput,
} from "./snapshot-content.js"

function fakeDb() {
  return {} as never
}

function makeRichAdapter(getContent: SourceAdapter["getContent"]): SourceAdapter {
  return {
    kind: "rich",
    capabilities: {
      verticals: ["products"],
      supportsLiveResolution: false,
      supportsDriftDetection: false,
      supportsBookingForwarding: false,
      postBookOperations: [],
      supportsContentFetch: true,
    },
    connect: async () => undefined,
    pause: async () => undefined,
    disconnect: async () => undefined,
    getState: async () => "active",
    discover: async () => ({ projections: [], next_cursor: undefined }),
    getContent,
  }
}

function makeThinAdapter(): SourceAdapter {
  return {
    kind: "thin",
    capabilities: {
      verticals: ["products"],
      supportsLiveResolution: false,
      supportsDriftDetection: false,
      supportsBookingForwarding: false,
      postBookOperations: [],
      supportsContentFetch: false,
    },
    connect: async () => undefined,
    pause: async () => undefined,
    disconnect: async () => undefined,
    getState: async () => "active",
    discover: async () => ({ projections: [], next_cursor: undefined }),
  }
}

const baseInput: SnapshotContentCaptureInput = {
  db: fakeDb(),
  entity_module: "products",
  entity_id: "prod_abc",
  source_kind: "rich",
  source_connection_id: "conn_1",
  source_ref: "REF-1",
  locale: "en-GB",
  market: "GB",
  currency: "GBP",
  adapterContext: { connection_id: "conn_1" },
}

describe("composeSnapshotContentCapturer — refresh-with-fallback per §5.1", () => {
  it("returns null when the entity_module isn't in the per-vertical map (owned / out-of-scope)", async () => {
    const registry = createSourceAdapterRegistry()
    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map(),
    })
    const result = await capturer({ ...baseInput, entity_module: "owned-vertical" })
    expect(result).toBeNull()
  })

  it("returns 'fresh' when the adapter call succeeds — writes through to cache", async () => {
    const fresh: GetContentResult = {
      entity_module: "products",
      entity_id: "prod_abc",
      source_ref: "REF-1",
      returned_locale: "en-GB",
      content: { product: { id: "prod_abc", name: "Sample" } },
      content_schema_version: "products/v1",
      etag: 'W/"abc"',
    }
    const refresh = vi.fn(async () => fresh)
    const verticalAdapter: ContentSnapshotAdapter = {
      refresh,
      readCached: async () => null,
    }
    const registry = createSourceAdapterRegistry()
    registry.register(makeRichAdapter(async () => fresh))

    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map([["products", verticalAdapter]]),
    })

    const result = await capturer(baseInput)
    expect(result).not.toBeNull()
    expect(result?.source).toBe("fresh")
    expect(result?.content_schema_version).toBe("products/v1")
    expect(result?.content_etag).toBe('W/"abc"')
    expect(result?.content).toEqual({ product: { id: "prod_abc", name: "Sample" } })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("falls back to cache when adapter.getContent throws", async () => {
    const cachedFetchedAt = new Date("2026-04-01T12:00:00Z")
    const verticalAdapter: ContentSnapshotAdapter = {
      refresh: vi.fn(async () => {
        throw new Error("upstream rate-limit")
      }),
      readCached: vi.fn(async () => ({
        payload: { product: { id: "prod_abc", name: "Sample (cached)" } },
        content_schema_version: "products/v1",
        fetched_at: cachedFetchedAt,
        etag: 'W/"old"',
      })),
    }
    const registry = createSourceAdapterRegistry()
    registry.register(
      makeRichAdapter(async () => {
        throw new Error("upstream rate-limit")
      }),
    )

    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map([["products", verticalAdapter]]),
    })

    const result = await capturer(baseInput)
    expect(result?.source).toBe("cache_fallback")
    expect(result?.fallback_reason).toBe("upstream rate-limit")
    expect(result?.fetched_at).toEqual(cachedFetchedAt)
    expect(result?.content).toEqual({ product: { id: "prod_abc", name: "Sample (cached)" } })
  })

  it("throws SnapshotContentUnavailableError when neither fresh nor cached produces content", async () => {
    const verticalAdapter: ContentSnapshotAdapter = {
      refresh: async () => {
        throw new Error("upstream down")
      },
      readCached: async () => null,
    }
    const registry = createSourceAdapterRegistry()
    registry.register(
      makeRichAdapter(async () => {
        throw new Error("upstream down")
      }),
    )

    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map([["products", verticalAdapter]]),
    })

    await expect(capturer(baseInput)).rejects.toBeInstanceOf(SnapshotContentUnavailableError)
  })

  it("returns cache-fallback when adapter is thin and a cache row exists", async () => {
    const cachedFetchedAt = new Date("2026-03-01T00:00:00Z")
    const verticalAdapter: ContentSnapshotAdapter = {
      refresh: async () => {
        throw new Error("should not be called for thin adapter")
      },
      readCached: async () => ({
        payload: { product: { id: "prod_abc", name: "Sample" } },
        content_schema_version: "products/v1",
        fetched_at: cachedFetchedAt,
        etag: null,
      }),
    }
    const registry = createSourceAdapterRegistry()
    registry.register(makeThinAdapter())

    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map([["products", verticalAdapter]]),
    })

    const result = await capturer({ ...baseInput, source_kind: "thin" })
    expect(result?.source).toBe("cache_fallback")
    expect(result?.fallback_reason).toContain("does not implement getContent")
  })

  it("throws when adapter is thin and no cache row exists", async () => {
    const verticalAdapter: ContentSnapshotAdapter = {
      refresh: async () => {
        throw new Error("never")
      },
      readCached: async () => null,
    }
    const registry = createSourceAdapterRegistry()
    registry.register(makeThinAdapter())

    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map([["products", verticalAdapter]]),
    })

    await expect(capturer({ ...baseInput, source_kind: "thin" })).rejects.toBeInstanceOf(
      SnapshotContentUnavailableError,
    )
  })

  it("threads the request scope (locale/market/currency) into refresh + readCached", async () => {
    const seenRequests: GetContentRequest[] = []
    const verticalAdapter: ContentSnapshotAdapter = {
      refresh: async (_db, _adapter, _ctx, request) => {
        seenRequests.push(request)
        return {
          entity_module: request.entity_module,
          entity_id: request.entity_id,
          source_ref: "REF-1",
          returned_locale: request.locale,
          content: {},
          content_schema_version: "products/v1",
        }
      },
      readCached: async () => null,
    }
    const registry = createSourceAdapterRegistry()
    registry.register(
      makeRichAdapter(async () => ({
        entity_module: "products",
        entity_id: "prod_abc",
        source_ref: "REF-1",
        returned_locale: "ro-RO",
        content: {},
        content_schema_version: "products/v1",
      })),
    )

    const capturer = composeSnapshotContentCapturer({
      registry,
      contentAdapters: new Map([["products", verticalAdapter]]),
    })

    await capturer({ ...baseInput, locale: "ro-RO", market: "RO", currency: "RON" })
    expect(seenRequests).toHaveLength(1)
    expect(seenRequests[0]?.locale).toBe("ro-RO")
    expect(seenRequests[0]?.market).toBe("RO")
    expect(seenRequests[0]?.currency).toBe("RON")
  })
})
