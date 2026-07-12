import { beforeEach, describe, expect, it, vi } from "vitest"

const { reindexEntity, ensureCollections, deleteEntity, buildProductSnapshotInput, db } =
  vi.hoisted(() => {
    const rows = [{ productId: "product_1" }, { productId: null }]
    const where = vi.fn(async () => rows)
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    return {
      reindexEntity: vi.fn(async () => undefined),
      ensureCollections: vi.fn(async () => undefined),
      deleteEntity: vi.fn(async () => undefined),
      buildProductSnapshotInput: vi.fn(async () => null),
      db: { select },
    }
  })

vi.mock("@voyant-travel/catalog", () => ({
  createIndexerService: () => ({ reindexEntity, ensureCollections, deleteEntity }),
}))

vi.mock("@voyant-travel/inventory/service-catalog-plane", () => ({
  buildProductSnapshotInput,
}))

vi.mock("@voyant-travel/catalog/standard-node/catalog-runtime", () => ({
  buildEmbeddingProvider: () => undefined,
  buildTypesenseIndexer: () => ({}),
  createProductsDocumentBuilder: () => vi.fn(),
  getFieldPolicyRegistries: () => new Map(),
  loadCatalogSlices: async () => [],
  withEmbedding: (builder: unknown) => builder,
}))

import { configureCatalogStandardNodeHost } from "@voyant-travel/catalog/standard-node/host"
import {
  createOperatorCatalogBookingSnapshotRuntime,
  createOperatorCatalogProjectionRuntime,
} from "@voyant-travel/catalog/standard-node/subscriber-runtime"

describe("Operator Catalog subscriber runtime ports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureCollections.mockResolvedValue(undefined)
    configureCatalogStandardNodeHost({
      database: {
        transaction: async (_bindings, operation) => operation(db),
      },
    } as never)
  })

  it("preserves publication reindex semantics", async () => {
    const runtime = createOperatorCatalogProjectionRuntime({
      TENANT_ID: "seller_1",
      TYPESENSE_HOST: "http://localhost:8108",
    })

    await runtime.reindexEntity({ entityModule: "products", entityId: "product_1" })

    expect(ensureCollections).toHaveBeenCalledTimes(1)
    expect(reindexEntity).toHaveBeenCalledWith("products", "product_1", expect.anything())
  })

  it("serializes collection setup across concurrent deliveries", async () => {
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
    const runtime = createOperatorCatalogProjectionRuntime({
      TYPESENSE_HOST: "http://localhost:8108",
    })

    const first = runtime.reindexEntity({ entityModule: "products", entityId: "product_1" })
    await firstEnsureStarted.promise
    const second = runtime.reindexEntity({ entityModule: "products", entityId: "product_2" })
    await Promise.resolve()
    expect(ensureCollections).toHaveBeenCalledTimes(1)
    releaseFirstEnsure.resolve()
    await Promise.all([first, second])

    expect(ensureCollections).toHaveBeenCalledTimes(2)
    expect(maxActiveEnsures).toBe(1)
  })

  it("provides booking products and package snapshot builders through one database lifetime", async () => {
    const runtime = createOperatorCatalogBookingSnapshotRuntime({ TENANT_ID: "seller_1" })

    await runtime.withContext(async (context) => {
      expect(context.sellerOperatorId).toBe("seller_1")
      await expect(context.findBookingProductIds("booking_1")).resolves.toEqual(["product_1", null])
      await context.buildSnapshotInput("product_1", {
        sellerOperatorId: "seller_1",
        scope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
      })
    })

    expect(buildProductSnapshotInput).toHaveBeenCalledWith(
      db,
      "product_1",
      expect.objectContaining({ sellerOperatorId: "seller_1" }),
    )
  })
})

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
