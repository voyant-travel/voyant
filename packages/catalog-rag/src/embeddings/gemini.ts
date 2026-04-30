/**
 * EmbeddingProvider implementation backed by Google's Gemini embeddings API.
 *
 * Uses native `fetch` so it works in Cloudflare Workers + Node + browsers
 * without an SDK dependency. Templates pass in the API key (and optionally
 * a custom `baseUrl` for proxies).
 *
 * Models supported by default:
 *   - `gemini-embedding-001` — 3072d, multilingual, current recommendation.
 *     Supports Matryoshka representation learning (MRL) — request a smaller
 *     output dimension via `outputDimensionality` to reduce storage cost.
 *   - `text-embedding-004` — 768d, multilingual, legacy stable.
 *
 * See `docs/architecture/catalog-rag-architecture.md` §6 for the design.
 */

import {
  chunkForBatch,
  EMBEDDING_BATCH_TOO_LARGE,
  EMBEDDING_INPUT_TOO_LONG,
  EMBEDDING_PROVIDER_ERROR,
  type EmbeddingProvider,
  type EmbeddingProviderCapabilities,
  EmbeddingProviderError,
} from "./contract.js"

/**
 * Known Gemini embedding models. `dimensions` is the *native* size; when
 * `outputDimensionality` is set in the provider options, the effective
 * vector size is whatever the caller requested (Gemini truncates server-side
 * via MRL on `gemini-embedding-001`).
 */
const GEMINI_MODELS = {
  "gemini-embedding-001": {
    dimensions: 3072,
    maxTokensPerInput: 2048,
    maxBatchSize: 100,
    multilingual: true,
    supportsOutputDimensionality: true,
  },
  "text-embedding-004": {
    dimensions: 768,
    maxTokensPerInput: 2048,
    maxBatchSize: 100,
    multilingual: true,
    supportsOutputDimensionality: false,
  },
} as const

export type GeminiEmbeddingModel = keyof typeof GEMINI_MODELS

/**
 * Tasks Gemini optimizes embeddings for. `RETRIEVAL_DOCUMENT` is the right
 * default for indexed catalog docs; switch to `RETRIEVAL_QUERY` when
 * embedding a search query at read time. The provider keeps a single task
 * type per instance — wire two providers if you index and query separately.
 */
export type GeminiTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"
  | "QUESTION_ANSWERING"
  | "FACT_VERIFICATION"
  | "CODE_RETRIEVAL_QUERY"

export interface GeminiEmbeddingProviderOptions {
  /**
   * API key to authenticate with. In `auth: "google"` mode, this is the
   * Google AI Studio key. In `auth: "bearer"` mode (e.g. when routing
   * through the Voyant Cloud AI gateway), this is the gateway's bearer
   * token.
   */
  apiKey: string
  /**
   * How to attach the API key to outbound requests.
   *  - `"google"` (default) — `x-goog-api-key: <apiKey>`. Use when
   *    talking directly to `generativelanguage.googleapis.com`.
   *  - `"bearer"` — `Authorization: Bearer <apiKey>`. Use when routing
   *    through the Voyant Cloud `/ai/v1/gemini` gateway, which forwards
   *    to Google with the org's saved provider key.
   */
  auth?: "google" | "bearer"
  /**
   * Embedding model to use. Default: `gemini-embedding-001`.
   * Switching models is a deliberate `bulkReindex` operation — the catalog
   * plane scopes vector queries to documents matching the active
   * `embedding_model_id`, so mid-migration mixes are handled cleanly.
   */
  model?: GeminiEmbeddingModel
  /**
   * Output vector size for MRL-capable models. When omitted, the model's
   * native dimension is used. Only `gemini-embedding-001` supports this.
   * Smaller dims reduce storage / query cost at some quality loss.
   */
  outputDimensionality?: number
  /**
   * Task type the embedded text will be used for. Default:
   * `RETRIEVAL_DOCUMENT` (right for ingestion). Use `RETRIEVAL_QUERY` for
   * read-side query embedding.
   */
  taskType?: GeminiTaskType
  /**
   * Override the API base URL — useful for a corporate proxy or a custom
   * Vertex-compatible deployment. Default:
   * `https://generativelanguage.googleapis.com/v1beta`.
   */
  baseUrl?: string
  /**
   * Optional `fetch` override for testing or custom transport. Default:
   * the global `fetch`. Must follow the standard Fetch API contract.
   */
  fetchImpl?: typeof fetch
  /**
   * Override the model id stamped onto search-index documents. Defaults
   * to `gemini/<model>/v1` — keep this stable across deployments so
   * documents stay queryable across instances.
   */
  modelId?: string
}

interface GeminiBatchEmbeddingResponse {
  embeddings: Array<{ values: number[] }>
}

interface GeminiErrorResponse {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

/**
 * Build a Gemini-backed EmbeddingProvider.
 */
export function createGeminiEmbeddingProvider(
  options: GeminiEmbeddingProviderOptions,
): EmbeddingProvider {
  const model: GeminiEmbeddingModel = options.model ?? "gemini-embedding-001"
  const modelInfo = GEMINI_MODELS[model]
  const baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(
    /\/$/,
    "",
  )
  const fetchImpl: typeof fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const taskType = options.taskType ?? "RETRIEVAL_DOCUMENT"
  const auth = options.auth ?? "google"
  const outputDimensionality =
    options.outputDimensionality && modelInfo.supportsOutputDimensionality
      ? options.outputDimensionality
      : undefined

  const dimensions = outputDimensionality ?? modelInfo.dimensions

  const capabilities: EmbeddingProviderCapabilities = {
    modelId: options.modelId ?? `gemini/${model}/v1`,
    dimensions,
    maxTokensPerInput: modelInfo.maxTokensPerInput,
    maxBatchSize: modelInfo.maxBatchSize,
    supportedLanguages: modelInfo.multilingual ? null : undefined,
  }

  return {
    capabilities,
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return []
      if (texts.length > capabilities.maxBatchSize) {
        throw new EmbeddingProviderError(
          EMBEDDING_BATCH_TOO_LARGE,
          `Gemini embedding batch size ${texts.length} exceeds max ${capabilities.maxBatchSize}; chunk inputs via chunkForBatch() first`,
        )
      }

      const url = `${baseUrl}/models/${model}:batchEmbedContents`
      const body = JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType,
          ...(outputDimensionality ? { outputDimensionality } : {}),
        })),
      })

      const authHeaders: Record<string, string> =
        auth === "bearer"
          ? { Authorization: `Bearer ${options.apiKey}` }
          : { "x-goog-api-key": options.apiKey }

      let response: Response
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body,
        })
      } catch (cause) {
        throw new EmbeddingProviderError(
          EMBEDDING_PROVIDER_ERROR,
          "Gemini embeddings request failed at the network layer",
          cause,
        )
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        let parsed: GeminiErrorResponse | undefined
        try {
          parsed = JSON.parse(text) as GeminiErrorResponse
        } catch {
          // ignore parse failure; surface the raw text
        }
        const message = parsed?.error?.message ?? text ?? `HTTP ${response.status}`
        const status = parsed?.error?.status ?? ""
        const code =
          status === "INVALID_ARGUMENT" ? EMBEDDING_INPUT_TOO_LONG : EMBEDDING_PROVIDER_ERROR
        throw new EmbeddingProviderError(
          code,
          `Gemini embeddings request failed (${response.status}): ${message}`,
        )
      }

      const json = (await response.json()) as GeminiBatchEmbeddingResponse
      // Gemini returns embeddings in input order — no `index` field.
      return json.embeddings.map((entry) => entry.values)
    },
  }
}

/**
 * Re-export the chunking helper alongside the Gemini provider so callers
 * can `embedBatched(provider, texts)` for very large inputs.
 */
export { chunkForBatch, GEMINI_MODELS }
