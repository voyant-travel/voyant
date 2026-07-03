/**
 * catalog-bridge — catalog reindex event triggers.
 *
 * Verifies the bridge subscribes to the distribution publication event and
 * promotion event, then reindexes affected products without racing Typesense
 * collection setup across event bursts. The catalog runtime + db helpers are
 * mocked so the test exercises only subscriber wiring (no Typesense / Postgres
 * required).
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

// eslint-disable-next-line import/first -- owner: operator-catalog-bridge; vi.mock calls above must be hoisted before the SUT import.
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

describe("catalog-bridge catalog reindex events", () => {
  beforeEach(() => {
    reindexEntity.mockClear()
    ensureCollections.mockReset()
    ensureCollections.mockResolvedValue(undefined)
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

  it("serializes collection setup across concurrent promotion.changed product reindex events", async () => {
    let activeEnsures = 0
    let maxActiveEnsures = 0
    const firstEnsureStarted = createDeferred<void>()
    const releaseFirstEnsure = createDeferred<void>()
    ensureCollections.mockImplementation(async () => {
      activeEnsures += 1
      maxActiveEnsures = Math.max(maxActiveEnsures, activeEnsures)
      if (ensureCollections.mock.calls.length === 1) {
        firstEnsureStarted.resolve()
        await releaseFirstEnsure.promise
      }
      activeEnsures -= 1
    })

    const { bus, handlers } = createTestBus()
    catalogBridgeBundle.bootstrap!({
      bindings: { TYPESENSE_HOST: "http://localhost:8108" } as never,
      container: {} as never,
      eventBus: bus as never,
    })

    expect(handlers.has("promotion.changed")).toBe(true)

    const first = bus.emit("promotion.changed", {
      offerId: "pofr_1",
      source: "updated",
      affected: { kind: "products", productIds: ["prod_1", "prod_2"] },
    })
    await firstEnsureStarted.promise
    const second = bus.emit("promotion.changed", {
      offerId: "pofr_2",
      source: "deleted",
      affected: { kind: "products", productIds: ["prod_3"] },
    })
    await Promise.resolve()

    expect(ensureCollections).toHaveBeenCalledTimes(1)
    releaseFirstEnsure.resolve()
    await Promise.all([first, second])

    expect(ensureCollections).toHaveBeenCalledTimes(2)
    expect(maxActiveEnsures).toBe(1)
    expect(reindexEntity).toHaveBeenCalledTimes(3)
    expect(reindexEntity).toHaveBeenNthCalledWith(1, "products", "prod_1", expect.anything())
    expect(reindexEntity).toHaveBeenNthCalledWith(2, "products", "prod_2", expect.anything())
    expect(reindexEntity).toHaveBeenNthCalledWith(3, "products", "prod_3", expect.anything())
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
