import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  reindexEntity,
  reindexEntityForSlice,
  ensureCollections,
  deleteEntity,
  buildProductSnapshotInput,
  db,
} = vi.hoisted(() => {
  const rows = [{ productId: "product_1" }, { productId: null }]
  const where = vi.fn(async () => rows)
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return {
    reindexEntity: vi.fn(async () => undefined),
    reindexEntityForSlice: vi.fn(async () => undefined),
    ensureCollections: vi.fn(async () => undefined),
    deleteEntity: vi.fn(async () => undefined),
    buildProductSnapshotInput: vi.fn(async () => null),
    db: { select },
  }
})

vi.mock("../services/indexer-service.js", () => ({
  createIndexerService: ({ slices }: { slices: Array<{ vertical: string }> }) => ({
    reindexEntity,
    reindexEntityForSlice,
    ensureCollections,
    deleteEntity,
    slicesForVertical: (entityModule: string) =>
      slices.filter((slice) => slice.vertical === entityModule),
  }),
}))

vi.mock("@voyant-travel/inventory/service-catalog-plane", () => ({
  buildProductSnapshotInput,
}))

import { configureCatalogRuntimeHost } from "./host.js"
import {
  createOperatorCatalogBookingSnapshotRuntime,
  createOperatorCatalogProjectionRuntime,
} from "./subscriber-runtime.js"

describe("Operator Catalog subscriber runtime ports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureCollections.mockResolvedValue(undefined)
    configureCatalogRuntimeHost(
      {
        database: {
          transaction: async <T>(
            _bindings: unknown,
            operation: (database: unknown) => Promise<T>,
          ) => operation(db),
        },
      } as never,
      { inventory: { buildSnapshotInput: buildProductSnapshotInput } } as never,
    )
  })

  it("preserves publication reindex semantics", async () => {
    const runtime = createProjectionRuntime({
      TENANT_ID: "seller_1",
      TYPESENSE_HOST: "http://localhost:8108",
    })

    await runtime.reindexEntity({ entityModule: "products", entityId: "product_1" })

    expect(ensureCollections).toHaveBeenCalledTimes(1)
    expect(reindexEntity).toHaveBeenCalledWith("products", "product_1", expect.anything())
  })

  it("reindexes only matching slices for scoped overlay targets", async () => {
    const runtime = createProjectionRuntime(
      {
        TYPESENSE_HOST: "http://localhost:8108",
      },
      {
        loadSlices: async () => [
          { vertical: "products", locale: "ro-RO", audience: "customer", market: "RO" },
          { vertical: "products", locale: "en-GB", audience: "customer", market: "GB" },
          { vertical: "cruises", locale: "ro-RO", audience: "customer", market: "RO" },
        ],
      },
    )

    await runtime.reindexEntity({
      entityModule: "products",
      entityId: "product_1",
      locale: "ro-RO",
      audience: "customer",
      market: "RO",
    })

    expect(reindexEntity).not.toHaveBeenCalled()
    expect(reindexEntityForSlice).toHaveBeenCalledTimes(1)
    expect(reindexEntityForSlice).toHaveBeenCalledWith(
      { vertical: "products", locale: "ro-RO", audience: "customer", market: "RO" },
      "product_1",
      expect.anything(),
    )
  })

  it("fans referenced-subject changes out through only matching scoped slices", async () => {
    const event = {
      entity_module: "cruise-ships",
      entity_id: "crsh_1",
      field_path: "name",
      locale: "ro-RO",
      audience: "customer",
      market: "RO",
      occurred_at: "2026-07-22T00:00:00.000Z",
    }
    const runtime = createProjectionRuntime(
      { TYPESENSE_HOST: "http://localhost:8108" },
      {
        loadSlices: async () => [
          { vertical: "cruise-ships", locale: "ro-RO", audience: "customer", market: "RO" },
          { vertical: "cruises", locale: "ro-RO", audience: "customer", market: "RO" },
          { vertical: "cruises", locale: "en-GB", audience: "customer", market: "GB" },
        ],
        reindexReferencedSubjectOverlayChange: async (_db, received, reindex) => {
          expect(received).toEqual(event)
          await reindex({
            entityModule: received.entity_module,
            entityId: received.entity_id,
            locale: received.locale,
            audience: received.audience,
            market: received.market,
          })
          await reindex({
            entityModule: "cruises",
            entityId: "cruise_1",
            locale: received.locale,
            audience: received.audience,
            market: received.market,
          })
        },
      },
    )

    await runtime.reindexReferencedSubject?.(event)

    expect(reindexEntityForSlice).toHaveBeenCalledTimes(2)
    expect(reindexEntityForSlice).toHaveBeenNthCalledWith(
      1,
      { vertical: "cruise-ships", locale: "ro-RO", audience: "customer", market: "RO" },
      "crsh_1",
      expect.anything(),
    )
    expect(reindexEntityForSlice).toHaveBeenNthCalledWith(
      2,
      { vertical: "cruises", locale: "ro-RO", audience: "customer", market: "RO" },
      "cruise_1",
      expect.anything(),
    )
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
    const runtime = createProjectionRuntime({
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

function createProjectionRuntime(
  bindings: Record<string, unknown>,
  overrides: Partial<Parameters<typeof createOperatorCatalogProjectionRuntime>[1]> = {},
) {
  return createOperatorCatalogProjectionRuntime(bindings, {
    buildEmbeddingProvider: () => undefined,
    buildIndexer: () => ({}),
    loadSlices: async () => [],
    fieldPolicyRegistries: () => new Map(),
    reindexReferencedSubjectOverlayChange: vi.fn(async () => undefined),
    createProductsDocumentBuilder: () => vi.fn(),
    createCatalogDocumentBuilder: () => vi.fn(),
    withEmbedding: (builder: unknown) => builder,
    ...overrides,
  } as never)
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
