# @voyantjs/voyant-catalog-rag

Phase 2 of the catalog plane. Adds vector embeddings, AI-agent access patterns, and the MCP server scaffolding on top of the Phase 1 foundation in `@voyantjs/voyant-catalog`.

See [`docs/architecture/catalog-rag-architecture.md`](../../docs/architecture/catalog-rag-architecture.md) for the full design.

## Install

```bash
pnpm add @voyantjs/voyant-catalog-rag
```

## What's in the box

- **`./embeddings/contract`** — `EmbeddingProvider` interface plus capability declarations (model id, dimensions, max tokens, max batch size, supported languages).
- **`./embeddings/openai`** — Default `EmbeddingProvider` implementation backed by OpenAI's embeddings API. Uses native `fetch` (works in Cloudflare Workers + Node).
- **`./embeddings/model-registry`** — Helpers for tracking embedding model identity per document, validating dimension compatibility at deployment startup, and supporting mixed-model migration windows.
- **`./search/semantic`** — Search orchestration helpers: build a hybrid `SearchRequest` with `mode: "semantic" | "hybrid" | "keyword"`, attach a `query_embedding` if the caller brought one, and delegate to the underlying `IndexerAdapter`.
- **`./search/federate`** — Cross-audience federated query helper for staff actors that need to search non-staff audience pools (architecture §7).

## Phase relationship

Phase 2 is **additive** on Phase 1. It does not modify the field-policy contract, the overlay store, the snapshot graph, or the source-adapter contract. The `IndexerAdapter` capability flags (`supportsVectorFields`, `supportsHybridSearch`, `vectorDimensions`, `supportsCrossAudienceFederation`) are already declared in Phase 1; Phase 2 deployments fill them in.

## Architectural rules (enforced by code, not just convention)

- **AI agents query the API, not the vector database directly.** Visibility filtering, overlay resolution, and audit all happen at the API layer. The vector DB is implementation detail.
- **Per-audience embedding pools.** Vectors are strictly per-audience — no cross-audience denormalization on the vector side. Customer chatbots' nearest-neighbor search runs against vectors that only ever saw customer-visible content.
- **Model versioning is explicit.** Each search-index document carries an `embedding_model_id`. Switching models is a deliberate `bulkReindex` migration, not silent.

## Usage

```typescript
import { createOpenAIEmbeddingProvider } from "@voyantjs/voyant-catalog-rag/embeddings/openai"

const embeddings = createOpenAIEmbeddingProvider({
  apiKey: env.OPENAI_API_KEY,
  model: "text-embedding-3-small", // 1536 dimensions, multilingual
})

// Generate embeddings for a batch of catalog texts
const vectors = await embeddings.embed([
  "Bali Wellness Retreat",
  "Sunset Yacht Cruise",
])
```

See `docs/architecture/catalog-rag-architecture.md` for the full design and integration patterns.
