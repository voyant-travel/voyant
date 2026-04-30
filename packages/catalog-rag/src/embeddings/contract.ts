/**
 * EmbeddingProvider contract — engine-agnostic interface for generating
 * vector embeddings from text.
 *
 * Voyant ships native OpenAI as the v1 default (see `./openai.ts`).
 * Deployments swap in Voyage AI, local sentence-transformers, Cohere,
 * or any other engine by satisfying this contract.
 *
 * See `docs/architecture/catalog-rag-architecture.md` §6 for the design.
 */

/**
 * Capability metadata declared by the provider. Used by the catalog plane
 * at deployment startup to validate that the configured embedding model is
 * compatible with the configured `IndexerAdapter`'s `vectorDimensions`.
 */
export interface EmbeddingProviderCapabilities {
  /**
   * Stable identifier for this provider+model combo. Conventional shape:
   * `<vendor>/<model-name>/<version>` — e.g. `openai/text-embedding-3-small/v1`.
   * Stamped onto every search-index document for migration safety.
   */
  modelId: string

  /**
   * Fixed dimensionality of vectors produced by `embed()`. Must match the
   * `IndexerAdapter`'s declared `vectorDimensions` or the catalog plane
   * fails fast at deployment.
   */
  dimensions: number

  /**
   * Maximum input token length per text. Texts longer than this should be
   * truncated by the caller before passing in (the provider rejects
   * oversize inputs rather than truncating silently).
   */
  maxTokensPerInput: number

  /**
   * Maximum batch size for a single `embed()` call. Larger batches must be
   * chunked by the caller. Common values: OpenAI 2048, Voyage 128.
   */
  maxBatchSize: number

  /**
   * ISO language codes the model handles well. `null` means multilingual
   * or language-agnostic (e.g. OpenAI's `text-embedding-3-small`).
   */
  supportedLanguages?: string[] | null
}

/**
 * The EmbeddingProvider contract. Implementations come from anywhere —
 * vendor SDKs, local models, custom wrappers. No implementer is privileged.
 *
 * Synchronous-shaped at the type level; concrete impls return promises.
 */
export interface EmbeddingProvider {
  readonly capabilities: EmbeddingProviderCapabilities

  /**
   * Generate one embedding per input text. Returns vectors in the same
   * order as the input. The result array has `texts.length` entries,
   * each with `capabilities.dimensions` floats.
   *
   * Throws on:
   *   - Provider/transport errors (rate limits, auth, network)
   *   - Inputs exceeding `capabilities.maxBatchSize` or `maxTokensPerInput`
   *
   * Implementations MUST NOT silently truncate or drop inputs.
   */
  embed(texts: string[]): Promise<number[][]>
}

/**
 * Standard error code adapters should throw when a constraint is violated.
 * The catalog plane translates these into structured error responses.
 */
export const EMBEDDING_BATCH_TOO_LARGE = "EMBEDDING_BATCH_TOO_LARGE" as const
export const EMBEDDING_INPUT_TOO_LONG = "EMBEDDING_INPUT_TOO_LONG" as const
export const EMBEDDING_PROVIDER_ERROR = "EMBEDDING_PROVIDER_ERROR" as const

export class EmbeddingProviderError extends Error {
  constructor(
    public readonly code:
      | typeof EMBEDDING_BATCH_TOO_LARGE
      | typeof EMBEDDING_INPUT_TOO_LONG
      | typeof EMBEDDING_PROVIDER_ERROR,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = "EmbeddingProviderError"
  }
}

/**
 * Thin helper for chunking a large input array into batches the provider
 * can handle. Provider implementations call this internally; callers can
 * also use it directly for finer-grained control.
 */
export function chunkForBatch<T>(items: T[], maxBatchSize: number): T[][] {
  if (maxBatchSize <= 0) {
    throw new Error("maxBatchSize must be positive")
  }
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += maxBatchSize) {
    batches.push(items.slice(i, i + maxBatchSize))
  }
  return batches
}
