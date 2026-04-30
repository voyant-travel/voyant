import { describe, expect, it } from "vitest"

import { chunkForBatch, EMBEDDING_BATCH_TOO_LARGE, EmbeddingProviderError } from "./contract.js"

describe("chunkForBatch", () => {
  it("returns a single batch when items fit in maxBatchSize", () => {
    expect(chunkForBatch([1, 2, 3], 5)).toEqual([[1, 2, 3]])
  })

  it("splits into multiple batches when items exceed maxBatchSize", () => {
    expect(chunkForBatch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it("returns an empty array for an empty input", () => {
    expect(chunkForBatch([], 10)).toEqual([])
  })

  it("throws on non-positive maxBatchSize", () => {
    expect(() => chunkForBatch([1], 0)).toThrow(/positive/)
    expect(() => chunkForBatch([1], -1)).toThrow(/positive/)
  })
})

describe("EmbeddingProviderError", () => {
  it("carries the standard error code", () => {
    const err = new EmbeddingProviderError(EMBEDDING_BATCH_TOO_LARGE, "too big")
    expect(err.code).toBe(EMBEDDING_BATCH_TOO_LARGE)
    expect(err.message).toBe("too big")
    expect(err.name).toBe("EmbeddingProviderError")
  })

  it("optionally retains the underlying cause", () => {
    const cause = new Error("original")
    const err = new EmbeddingProviderError(EMBEDDING_BATCH_TOO_LARGE, "wrapped", cause)
    expect(err.cause).toBe(cause)
  })
})
