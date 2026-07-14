/**
 * Embedding model registry helpers.
 *
 * Each search-index document carries an `embedding_model_id` field that
 * identifies which model produced its vector. The registry's job is to:
 *
 *   1. Validate at deployment startup that the configured embedding
 *      provider's `dimensions` matches the configured `IndexerAdapter`'s
 *      `vectorDimensions`. Mismatch → fail loudly.
 *   2. Track the active model id so search queries can scope vector
 *      lookups to documents using a compatible model. During a model
 *      migration window the index can hold mixed-model documents — old
 *      ones get skipped on vector queries and re-embedded by the
 *      `bulkReindex(forceReembed: true)` job.
 *
 * See `docs/architecture/catalog-architecture.md` for the design.
 */

import type { IndexerCapabilities } from "@voyant-travel/catalog-contracts/indexer/contract"

import type { EmbeddingProviderCapabilities } from "./contract.js"

/**
 * Validate that an embedding provider's capabilities are compatible with
 * the search engine's vector configuration. Call this at deployment
 * startup; throw if incompatible.
 */
export function validateEmbeddingCompatibility(
  providerCapabilities: EmbeddingProviderCapabilities,
  indexerCapabilities: IndexerCapabilities,
): void {
  if (!indexerCapabilities.supportsVectorFields) {
    throw new Error(
      `IndexerAdapter does not support vector fields, but an embedding provider is configured (model: ${providerCapabilities.modelId}). ` +
        `Disable embeddings or swap to an indexer that supports them (e.g. Typesense).`,
    )
  }
  if (
    indexerCapabilities.vectorDimensions != null &&
    indexerCapabilities.vectorDimensions !== providerCapabilities.dimensions
  ) {
    throw new Error(
      `Embedding model ${providerCapabilities.modelId} produces ${providerCapabilities.dimensions}-d vectors, ` +
        `but IndexerAdapter is configured for ${indexerCapabilities.vectorDimensions}-d. ` +
        `Either reconfigure the indexer's vectorDimensions, or swap to a compatible embedding model.`,
    )
  }
  if (
    indexerCapabilities.maxVectorsPerDocument != null &&
    indexerCapabilities.maxVectorsPerDocument < 1
  ) {
    throw new Error(
      `IndexerAdapter declares maxVectorsPerDocument=${indexerCapabilities.maxVectorsPerDocument} but Phase 2 requires at least 1 vector per document.`,
    )
  }
}

/**
 * Returns true if a given document's `embedding_model_id` matches the
 * deployment's active model. Vector queries should filter to active-model
 * documents; non-matching documents fall through to keyword-only
 * scoring until `bulkReindex(forceReembed: true)` re-embeds them.
 */
export function isActiveEmbeddingModel(
  documentModelId: string | undefined,
  activeModelId: string,
): boolean {
  return documentModelId === activeModelId
}

/**
 * Convenience: stamp an `IndexerDocument`'s `embedding_model_id` from a
 * provider's capabilities. Use this when constructing documents in the
 * embedding pipeline so the active model id propagates to the index.
 */
export function stampEmbeddingModelId(providerCapabilities: EmbeddingProviderCapabilities): {
  embedding_model_id: string
} {
  return { embedding_model_id: providerCapabilities.modelId }
}

/**
 * Plan the embedding workload for a re-index pipeline. Given the current
 * document set (each row tagged with its embedding_model_id) and the
 * active model, returns lists of:
 *   - `embedded` — already on the active model; no work
 *   - `pending` — never embedded; needs first-time embedding
 *   - `migrating` — embedded under an older model; needs re-embedding
 *
 * Drives the `bulkReindex(forceReembed: true)` migration UX.
 */
export interface EmbeddingMigrationPlan {
  embedded: string[]
  pending: string[]
  migrating: string[]
  totalDocuments: number
  activeModelId: string
}

export function planEmbeddingMigration(
  documents: ReadonlyArray<{ id: string; embedding_model_id?: string | null }>,
  activeModelId: string,
): EmbeddingMigrationPlan {
  const embedded: string[] = []
  const pending: string[] = []
  const migrating: string[] = []
  for (const doc of documents) {
    if (!doc.embedding_model_id) {
      pending.push(doc.id)
    } else if (doc.embedding_model_id === activeModelId) {
      embedded.push(doc.id)
    } else {
      migrating.push(doc.id)
    }
  }
  return {
    embedded,
    pending,
    migrating,
    totalDocuments: documents.length,
    activeModelId,
  }
}
