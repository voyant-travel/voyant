import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CATALOG_REINDEX_BATCH_SIZE,
  CatalogReindexError,
  runCatalogReindexProducts,
  runCatalogReindexProductsJob,
} from "./reindex-job.js"
import type {
  CatalogReindexClaim,
  CatalogReindexJobRuntime,
  CatalogReindexProgress,
} from "./reindex-job-runtime-port.js"

const initialClaim: CatalogReindexClaim = {
  tenantId: "tenant_pro_travel",
  generation: 4,
  leaseOwner: "lease_1",
  batches: 0,
  scanned: 0,
  indexed: 0,
  retries: 0,
}

afterEach(() => {
  vi.useRealTimers()
})

function createRuntime(
  productIds: readonly string[],
  claim: CatalogReindexClaim | null = initialClaim,
) {
  const indexed: string[] = []
  const pages: Array<{ afterId?: string; limit: number }> = []
  const progress: CatalogReindexProgress[] = []
  const checkpoints: unknown[] = []
  let completed = false
  let released = false
  const runtime: CatalogReindexJobRuntime = {
    requestGeneration: vi.fn(async () => 4),
    claimWork: vi.fn(async () => claim),
    renewLease: vi.fn(async () => true),
    checkpoint: vi.fn(async (_claim, checkpoint) => {
      checkpoints.push(checkpoint)
      return true
    }),
    complete: vi.fn(async () => {
      completed = true
      return true
    }),
    releaseLease: vi.fn(async () => {
      released = true
    }),
    async listProductIdsPage(input) {
      pages.push(input)
      const start = input.afterId ? productIds.indexOf(input.afterId) + 1 : 0
      return productIds.slice(start, start + input.limit)
    },
    async reindexProduct(productId) {
      indexed.push(productId)
    },
    reportProgress(update) {
      progress.push(update)
    },
    sleep: vi.fn(async () => undefined),
    createLeaseOwner: () => "lease_1",
  }
  return {
    checkpoints,
    completed: () => completed,
    indexed,
    pages,
    progress,
    released: () => released,
    runtime,
  }
}

describe("catalog product reindex job", () => {
  it("walks canonical product IDs in bounded pages and checkpoints every batch", async () => {
    const productIds = Array.from(
      { length: CATALOG_REINDEX_BATCH_SIZE * 2 + 5 },
      (_, index) => `product_${String(index).padStart(3, "0")}`,
    )
    const harness = createRuntime(productIds)

    await expect(runCatalogReindexProducts(harness.runtime)).resolves.toEqual({
      tenantId: "tenant_pro_travel",
      generation: 4,
      afterId: "product_204",
      batches: 3,
      scanned: 205,
      indexed: 205,
      retries: 0,
    })
    expect(harness.indexed).toEqual(productIds)
    expect(harness.pages).toEqual([
      { afterId: undefined, limit: CATALOG_REINDEX_BATCH_SIZE },
      { afterId: "product_099", limit: CATALOG_REINDEX_BATCH_SIZE },
      { afterId: "product_199", limit: CATALOG_REINDEX_BATCH_SIZE },
    ])
    expect(harness.checkpoints).toHaveLength(3)
    expect(harness.completed()).toBe(true)
    expect(harness.released()).toBe(false)
    expect(harness.progress.at(-1)).toEqual({
      phase: "complete",
      tenantId: "tenant_pro_travel",
      generation: 4,
      batches: 3,
      scanned: 205,
      indexed: 205,
      retries: 0,
    })
  })

  it("resumes after the durable cursor and counters", async () => {
    const productIds = ["product_001", "product_002", "product_003"]
    const harness = createRuntime(productIds, {
      ...initialClaim,
      afterId: "product_001",
      batches: 1,
      scanned: 1,
      indexed: 1,
      retries: 2,
    })

    await expect(runCatalogReindexProducts(harness.runtime)).resolves.toMatchObject({
      afterId: "product_003",
      batches: 2,
      scanned: 3,
      indexed: 3,
      retries: 2,
    })
    expect(harness.indexed).toEqual(["product_002", "product_003"])
    expect(harness.pages[0]).toEqual({
      afterId: "product_001",
      limit: CATALOG_REINDEX_BATCH_SIZE,
    })
  })

  it("retries one projection, releases the lease, and preserves the previous checkpoint", async () => {
    const harness = createRuntime(["product_001", "product_002", "product_003"])
    const attempts = new Map<string, number>()
    harness.runtime.reindexProduct = vi.fn(async (productId) => {
      const attempt = (attempts.get(productId) ?? 0) + 1
      attempts.set(productId, attempt)
      if (productId === "product_002") throw new Error("permanent")
      harness.indexed.push(productId)
    })

    const failure = await runCatalogReindexProducts(harness.runtime).catch((error) => error)

    expect(failure).toBeInstanceOf(CatalogReindexError)
    expect(failure.result).toMatchObject({
      tenantId: "tenant_pro_travel",
      generation: 4,
      scanned: 2,
      indexed: 1,
      retries: 2,
    })
    expect(harness.checkpoints).toEqual([])
    expect(harness.completed()).toBe(false)
    expect(harness.released()).toBe(true)
    expect(harness.progress).toContainEqual({
      phase: "failure",
      tenantId: "tenant_pro_travel",
      generation: 4,
      productId: "product_002",
      attempts: 3,
      error: "permanent",
    })
  })

  it("threads the concrete job bindings through the runtime provider", async () => {
    const harness = createRuntime([])
    const bindings = { TENANT_ID: "tenant_pro_travel", DATABASE_URL: "postgres://tenant" }
    const createJobRuntime = vi.fn(async () => harness.runtime)
    const getPort = vi.fn(async () => ({ createRuntime: createJobRuntime }))

    await runCatalogReindexProductsJob({ bindings, getPort } as never)

    expect(createJobRuntime).toHaveBeenCalledWith(bindings)
    expect(harness.runtime.requestGeneration).toHaveBeenCalledOnce()
    expect(harness.runtime.claimWork).toHaveBeenCalledWith("lease_1")
  })

  it("stops heartbeats before draining a deferred renewal and committing success", async () => {
    vi.useFakeTimers()
    const harness = createRuntime(["product_001"])
    let finishReindex: (() => void) | undefined
    let finishRenewal: ((renewed: boolean) => void) | undefined
    harness.runtime.reindexProduct = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishReindex = resolve
        }),
    )
    harness.runtime.renewLease = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishRenewal = resolve
        }),
    )

    const execution = runCatalogReindexProducts(harness.runtime)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(harness.runtime.renewLease).toHaveBeenCalledOnce()

    finishReindex?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.runtime.complete).not.toHaveBeenCalled()

    finishRenewal?.(true)
    await expect(execution).resolves.toMatchObject({ indexed: 1 })
    expect(harness.runtime.complete).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(harness.runtime.renewLease).toHaveBeenCalledOnce()
  })

  it("rejects job invocation without concrete deployment bindings", async () => {
    await expect(runCatalogReindexProductsJob({ getPort: vi.fn() } as never)).rejects.toThrow(
      "requires concrete deployment job bindings",
    )
  })
})
