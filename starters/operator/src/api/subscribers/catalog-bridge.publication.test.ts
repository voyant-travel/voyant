/**
 * catalog-bridge — `product.publication.changed` reindex trigger.
 *
 * Verifies the bridge subscribes to the distribution publication event and
 * reindexes the affected product's customer-facing slices. The catalog
 * runtime + db helpers are mocked so the test exercises only the subscriber
 * wiring (no Typesense / Postgres required).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const reindexEntity = vi.fn(async () => {})
const ensureCollections = vi.fn(async () => {})
const deleteEntity = vi.fn(async () => {})

vi.mock("@voyant-travel/catalog", () => ({
  createIndexerService: () => ({ reindexEntity, ensureCollections, deleteEntity }),
  captureSnapshotGraphIdempotent: vi.fn(async () => {}),
}))

vi.mock("@voyant-travel/commerce", () => ({
  recordPromotionRedemptionsForBooking: vi.fn(async () => {}),
}))

vi.mock("@voyant-travel/inventory/service-catalog-plane", () => ({
  buildProductSnapshotInput: vi.fn(async () => null),
}))

vi.mock("@voyant-travel/bookings/schema", () => ({
  bookingItems: {},
}))

vi.mock("../lib/catalog-runtime", () => ({
  buildEmbeddingProvider: () => undefined,
  buildTypesenseIndexer: () => ({}), // truthy → indexer configured
  createProductsDocumentBuilder: () => vi.fn(),
  getFieldPolicyRegistries: () => new Map(),
  loadCatalogSlices: async () => [],
  withEmbedding: (builder: unknown) => builder,
}))

vi.mock("../lib/db", () => ({
  withDbFromEnv: async (_env: unknown, fn: (db: unknown) => Promise<void>) => fn({}),
}))

// eslint-disable-next-line import/first -- the vi.mock calls above must be hoisted before the SUT import
import { catalogBridgeBundle } from "./catalog-bridge"

type Handler = (envelope: { data: unknown }) => Promise<void> | void

function createTestBus() {
  const handlers = new Map<string, Handler[]>()
  const bus = {
    subscribe(event: string, handler: Handler) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
      return { unsubscribe() {} }
    },
    async emit(event: string, data: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        await handler({ data })
      }
    },
  }
  return { bus, handlers }
}

describe("catalog-bridge product.publication.changed", () => {
  beforeEach(() => {
    reindexEntity.mockClear()
    ensureCollections.mockClear()
  })

  it("reindexes the product when a publication event fires", async () => {
    const { bus, handlers } = createTestBus()
    catalogBridgeBundle.bootstrap!({
      bindings: { TYPESENSE_HOST: "http://localhost:8108" } as never,
      container: {} as never,
      eventBus: bus as never,
    })

    expect(handlers.has("product.publication.changed")).toBe(true)

    await bus.emit("product.publication.changed", {
      productId: "prod_123",
      channelId: "chan_1",
      operation: "activated",
    })

    expect(ensureCollections).toHaveBeenCalled()
    expect(reindexEntity).toHaveBeenCalledWith("products", "prod_123", expect.anything())
  })

  it("ignores a payload with no productId", async () => {
    const { bus } = createTestBus()
    catalogBridgeBundle.bootstrap!({
      bindings: { TYPESENSE_HOST: "http://localhost:8108" } as never,
      container: {} as never,
      eventBus: bus as never,
    })

    await bus.emit("product.publication.changed", {
      productId: "",
      channelId: "chan_1",
      operation: "deleted",
    })

    expect(reindexEntity).not.toHaveBeenCalled()
  })
})
