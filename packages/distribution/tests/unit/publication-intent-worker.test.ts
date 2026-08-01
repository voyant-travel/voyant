import { describe, expect, it, vi } from "vitest"

import { drainPublicationReindexIntents } from "../../src/publication-intent-worker.js"

const productIntent = {
  id: "intent_product",
  channelId: "chan_web",
  kind: "product" as const,
  productId: "prod_1",
  supplierId: null,
  cursor: null,
  attempts: 0,
  leaseOwner: "worker_1",
}

const supplierIntent = {
  id: "intent_supplier",
  channelId: "chan_web",
  kind: "supplier" as const,
  productId: null,
  supplierId: "sup_1",
  cursor: null,
  attempts: 1,
  leaseOwner: "worker_1",
}

describe("publication reindex intent worker", () => {
  it("claims a bounded product intent and completes it after reindex", async () => {
    const db = fakeDb({
      executeResults: [{ rows: [productIntent] }, { rows: [] }, { rows: [] }],
    })
    const projection = {
      reindexEntity: vi.fn(async () => {}),
      deleteEntity: vi.fn(async () => {}),
    }

    await expect(
      drainPublicationReindexIntents(
        { db: db as never, projection },
        { leaseOwner: "worker_1", maxIntents: 1 },
      ),
    ).resolves.toEqual({ processed: 1 })

    expect(projection.reindexEntity).toHaveBeenCalledWith({
      entityModule: "products",
      entityId: "prod_1",
    })
    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it("checkpoints supplier intents by cursor when a page reaches the batch limit", async () => {
    const db = fakeDb({
      executeResults: [{ rows: [supplierIntent] }, { rows: [] }, { rows: [] }],
      productPages: [[{ id: "prod_1" }, { id: "prod_2" }]],
    })
    const projection = {
      reindexEntity: vi.fn(async () => {}),
      deleteEntity: vi.fn(async () => {}),
    }

    await expect(
      drainPublicationReindexIntents(
        { db: db as never, projection },
        { leaseOwner: "worker_1", maxIntents: 1, productBatchSize: 2 },
      ),
    ).resolves.toEqual({ processed: 1 })

    expect(projection.reindexEntity.mock.calls.map(([input]) => input.entityId)).toEqual([
      "prod_1",
      "prod_2",
    ])
    expect(db.limitValues).toEqual([2])
    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it("keeps a checkpointed row leased and resumes it without returning to pending", async () => {
    const resumedIntent = { ...supplierIntent, cursor: "prod_2" }
    const db = fakeDb({
      executeResults: [
        { rows: [supplierIntent] },
        { rows: [] },
        { rows: [resumedIntent] },
        { rows: [] },
      ],
      productPages: [[{ id: "prod_1" }, { id: "prod_2" }], [{ id: "prod_3" }]],
    })
    const projection = {
      reindexEntity: vi.fn(async () => {}),
      deleteEntity: vi.fn(async () => {}),
    }

    await expect(
      drainPublicationReindexIntents(
        { db: db as never, projection },
        { leaseOwner: "worker_1", maxIntents: 2, productBatchSize: 2 },
      ),
    ).resolves.toEqual({ processed: 2 })

    expect(projection.reindexEntity.mock.calls.map(([input]) => input.entityId)).toEqual([
      "prod_1",
      "prod_2",
      "prod_3",
    ])
    expect(db.execute).toHaveBeenCalledTimes(4)
  })

  it("marks failures for retry and continues draining", async () => {
    const db = fakeDb({
      executeResults: [{ rows: [productIntent] }, { rows: [] }, { rows: [] }],
    })
    const report = vi.fn()
    const projection = {
      reindexEntity: vi.fn(async () => {
        throw new Error("index unavailable")
      }),
      deleteEntity: vi.fn(async () => {}),
    }

    await expect(
      drainPublicationReindexIntents(
        { db: db as never, projection, report },
        { leaseOwner: "worker_1", maxIntents: 2, retryDelayMs: 5 },
      ),
    ).resolves.toEqual({ processed: 1 })

    expect(report).toHaveBeenCalledWith(
      "[distribution-publication-intents] intent failed",
      expect.objectContaining({ intentId: "intent_product", error: "index unavailable" }),
    )
    expect(db.execute).toHaveBeenCalledTimes(3)
  })
})

function fakeDb(input: { executeResults: unknown[]; productPages?: Array<Array<{ id: string }>> }) {
  const executeResults = [...input.executeResults]
  const productPages = [...(input.productPages ?? [])]
  const limitValues: number[] = []
  return {
    limitValues,
    execute: vi.fn(async () => executeResults.shift() ?? { rows: [] }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async (limit: number) => {
              limitValues.push(limit)
              return productPages.shift() ?? []
            },
          }),
        }),
      }),
    }),
  }
}
