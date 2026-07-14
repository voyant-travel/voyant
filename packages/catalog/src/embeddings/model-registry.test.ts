import type { IndexerCapabilities } from "@voyant-travel/catalog-contracts/indexer/contract"
import { describe, expect, it } from "vitest"

import type { EmbeddingProviderCapabilities } from "./contract.js"
import {
  isActiveEmbeddingModel,
  planEmbeddingMigration,
  stampEmbeddingModelId,
  validateEmbeddingCompatibility,
} from "./model-registry.js"

const provider: EmbeddingProviderCapabilities = {
  modelId: "openai/text-embedding-3-small/v1",
  dimensions: 1536,
  maxTokensPerInput: 8191,
  maxBatchSize: 2048,
  supportedLanguages: null,
}

const indexerCompatible: IndexerCapabilities = {
  supportsKeywordSearch: true,
  supportsHybridSearch: true,
  supportsVectorFields: true,
  vectorDimensions: 1536,
  maxVectorsPerDocument: null,
  supportsCrossAudienceFederation: true,
  supportsAdminDenormalization: true,
}

describe("validateEmbeddingCompatibility", () => {
  it("succeeds when dimensions match", () => {
    expect(() => validateEmbeddingCompatibility(provider, indexerCompatible)).not.toThrow()
  })

  it("throws when the indexer does not support vector fields", () => {
    expect(() =>
      validateEmbeddingCompatibility(provider, {
        ...indexerCompatible,
        supportsVectorFields: false,
      }),
    ).toThrow(/does not support vector fields/)
  })

  it("throws when dimensions mismatch", () => {
    expect(() =>
      validateEmbeddingCompatibility(provider, { ...indexerCompatible, vectorDimensions: 768 }),
    ).toThrow(/1536-d/)
  })

  it("accepts null vectorDimensions on the indexer (deferred config)", () => {
    expect(() =>
      validateEmbeddingCompatibility(provider, { ...indexerCompatible, vectorDimensions: null }),
    ).not.toThrow()
  })

  it("throws when maxVectorsPerDocument is < 1", () => {
    expect(() =>
      validateEmbeddingCompatibility(provider, {
        ...indexerCompatible,
        maxVectorsPerDocument: 0,
      }),
    ).toThrow(/at least 1 vector/)
  })
})

describe("isActiveEmbeddingModel", () => {
  it("returns true when ids match", () => {
    expect(isActiveEmbeddingModel(provider.modelId, provider.modelId)).toBe(true)
  })

  it("returns false for missing or mismatched ids", () => {
    expect(isActiveEmbeddingModel(undefined, provider.modelId)).toBe(false)
    expect(isActiveEmbeddingModel("openai/text-embedding-3-large/v1", provider.modelId)).toBe(false)
  })
})

describe("stampEmbeddingModelId", () => {
  it("returns an object with the model id from capabilities", () => {
    expect(stampEmbeddingModelId(provider)).toEqual({
      embedding_model_id: provider.modelId,
    })
  })
})

describe("planEmbeddingMigration", () => {
  it("partitions documents into embedded / pending / migrating", () => {
    const docs = [
      { id: "a", embedding_model_id: "openai/text-embedding-3-small/v1" },
      { id: "b", embedding_model_id: undefined },
      { id: "c", embedding_model_id: null },
      { id: "d", embedding_model_id: "openai/text-embedding-ada-002/v1" },
      { id: "e", embedding_model_id: "openai/text-embedding-3-small/v1" },
    ]
    const plan = planEmbeddingMigration(docs, "openai/text-embedding-3-small/v1")
    expect(plan.embedded.sort()).toEqual(["a", "e"])
    expect(plan.pending.sort()).toEqual(["b", "c"])
    expect(plan.migrating).toEqual(["d"])
    expect(plan.totalDocuments).toBe(5)
    expect(plan.activeModelId).toBe("openai/text-embedding-3-small/v1")
  })

  it("handles an empty document list", () => {
    const plan = planEmbeddingMigration([], "x")
    expect(plan.totalDocuments).toBe(0)
    expect(plan.embedded).toEqual([])
    expect(plan.pending).toEqual([])
    expect(plan.migrating).toEqual([])
  })
})
