/**
 * Default EmbeddingProvider implementation backed by OpenAI's embeddings API.
 *
 * Uses native `fetch` so it works in Cloudflare Workers + Node + browsers
 * without an SDK dependency. Templates pass in the API key (and optionally
 * a custom `baseUrl` for proxies / Azure OpenAI / OpenRouter etc.).
 *
 * Models supported by default:
 *   - `text-embedding-3-small` — 1536d, multilingual, cheapest. **Default.**
 *   - `text-embedding-3-large` — 3072d, multilingual, higher quality.
 *   - `text-embedding-ada-002` — 1536d, legacy (kept for migration paths).
 *
 * See `docs/architecture/catalog-architecture.md` for the design.
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
 * Known OpenAI embedding models. Adding a new entry here is the only place
 * to touch when OpenAI ships a new model — `createOpenAIEmbeddingProvider`
 * picks up the dimensions / batch limits automatically.
 */
const OPENAI_MODELS = {
  "text-embedding-3-small": {
    dimensions: 1536,
    maxTokensPerInput: 8191,
    maxBatchSize: 2048,
    multilingual: true,
  },
  "text-embedding-3-large": {
    dimensions: 3072,
    maxTokensPerInput: 8191,
    maxBatchSize: 2048,
    multilingual: true,
  },
  "text-embedding-ada-002": {
    dimensions: 1536,
    maxTokensPerInput: 8191,
    maxBatchSize: 2048,
    multilingual: true,
  },
} as const

export type OpenAIEmbeddingModel = keyof typeof OPENAI_MODELS

export interface OpenAIEmbeddingProviderOptions {
  /** OpenAI API key. */
  apiKey: string
  /**
   * Embedding model to use. Default: `text-embedding-3-small`.
   * Switching models is a deliberate `bulkReindex` operation — the catalog
   * plane scopes vector queries to documents matching the active
   * `embedding_model_id`, so mid-migration mixes are handled cleanly.
   */
  model?: OpenAIEmbeddingModel
  /**
   * Override the API base URL — useful for Azure OpenAI, OpenRouter,
   * a corporate proxy, or any OpenAI-API-compatible service. Default:
   * `https://api.openai.com/v1`.
   */
  baseUrl?: string
  /**
   * Optional `fetch` override for testing or custom transport. Default:
   * the global `fetch`. Must follow the standard Fetch API contract.
   */
  fetchImpl?: typeof fetch
  /**
   * Override the model id stamped onto search-index documents. Defaults
   * to `openai/<model>/v1` — keep this stable across deployments so
   * documents stay queryable across instances.
   */
  modelId?: string
}

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{ object: string; index: number; embedding: number[] }>
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
}

interface OpenAIErrorResponse {
  error?: { message?: string; type?: string; code?: string }
}

/**
 * Build the default OpenAI EmbeddingProvider.
 */
export function createOpenAIEmbeddingProvider(
  options: OpenAIEmbeddingProviderOptions,
): EmbeddingProvider {
  const model: OpenAIEmbeddingModel = options.model ?? "text-embedding-3-small"
  const modelInfo = OPENAI_MODELS[model]
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")
  const fetchImpl: typeof fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  const capabilities: EmbeddingProviderCapabilities = {
    modelId: options.modelId ?? `openai/${model}/v1`,
    dimensions: modelInfo.dimensions,
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
          `OpenAI embedding batch size ${texts.length} exceeds max ${capabilities.maxBatchSize}; chunk inputs via chunkForBatch() first`,
        )
      }
      // Rough byte-length sanity check — actual token limits enforced by API.
      // We pass through and let OpenAI return its specific error if too long.
      const url = `${baseUrl}/embeddings`
      const body = JSON.stringify({ input: texts, model })
      let response: Response
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`,
          },
          body,
        })
      } catch (cause) {
        throw new EmbeddingProviderError(
          EMBEDDING_PROVIDER_ERROR,
          "OpenAI embeddings request failed at the network layer",
          cause,
        )
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        let parsed: OpenAIErrorResponse | undefined
        try {
          parsed = JSON.parse(text) as OpenAIErrorResponse
        } catch {
          // ignore parse failure; surface the raw text
        }
        const message = parsed?.error?.message ?? text ?? `HTTP ${response.status}`
        const code =
          parsed?.error?.code === "context_length_exceeded"
            ? EMBEDDING_INPUT_TOO_LONG
            : EMBEDDING_PROVIDER_ERROR
        throw new EmbeddingProviderError(
          code,
          `OpenAI embeddings request failed (${response.status}): ${message}`,
        )
      }

      const json = (await response.json()) as OpenAIEmbeddingResponse
      // OpenAI returns vectors in `data` with explicit `index` — sort to
      // guarantee output order matches input order regardless of API
      // implementation detail.
      const sorted = [...json.data].sort((a, b) => a.index - b.index)
      return sorted.map((entry) => entry.embedding)
    },
  }
}

/**
 * Helper that chunks a large input array into batches sized to the model's
 * `maxBatchSize` and concatenates the per-batch results. Use this when
 * embedding more than `maxBatchSize` texts at once.
 */
export async function embedBatched(
  provider: EmbeddingProvider,
  texts: string[],
): Promise<number[][]> {
  if (texts.length <= provider.capabilities.maxBatchSize) {
    return provider.embed(texts)
  }
  const batches = chunkForBatch(texts, provider.capabilities.maxBatchSize)
  const results: number[][] = []
  for (const batch of batches) {
    const vectors = await provider.embed(batch)
    results.push(...vectors)
  }
  return results
}

export { OPENAI_MODELS }
