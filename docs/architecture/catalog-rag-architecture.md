# Catalog RAG architecture — Phase 2

Status: draft / proposal — Phase 2 of the catalog plane
Audience: anyone designing or implementing the semantic-search, embeddings, and AI-agent access surfaces of the catalog plane.

This document covers the **Phase 2** work that sits on top of the catalog foundation defined in [`catalog-architecture.md`](./catalog-architecture.md). It is intentionally separated from the foundation doc because:

- The foundation (Phase 1) ships as keyword + hybrid-keyword search via the indexer; it is complete and useful without any embeddings or AI surface.
- Phase 2 adds vector embeddings, AI agent access, and the MCP server. None of this is required for the catalog plane to do its job; it is real value-add work that earns its own design and timeline.

## 1. Phase relationship

**Prerequisites** (must be live before Phase 2 lands):

- Phase 1 catalog foundation: field-policy contract, overlay store, snapshot graph, source adapter contract, drift events, webhooks, source disconnect lifecycle.
- The native Typesense `IndexerAdapter` implementation (or a swap-in that declares vector support).
- All five existing verticals have adopted the catalog contract per Phase 1's plan.

**What Phase 2 adds:**

- Vector embeddings for CatalogEntry resolved views, stored in the search index (no separate vector DB).
- `EmbeddingProvider` contract with a default OpenAI implementation and operator-swappable alternatives.
- An async embedding-generation pipeline that rides the existing reindex queue.
- Embedding model registry with explicit migration tooling for model upgrades.
- API mode parameter (`mode: "semantic" | "hybrid" | "keyword"`) on the existing search endpoints.
- Per-audience embedding pools with strict isolation guarantees for AI agent access.
- An MCP (Model Context Protocol) server wrapping the search and entity APIs as agent-callable tools.

**What Phase 2 does NOT change:**

- The Phase 1 field-policy contract stays at 12 attributes. Phase 2 introduces embedding selection (see §4) but does so without growing the v1 contract — selection is declared per vertical in the catalog-policy file rather than as a 13th policy attribute, unless and until we promote it later.
- The overlay store, snapshot graph, webhook taxonomy, and source-adapter contract are unchanged.
- The composition rules (nested / promoted / referenced) and conventions (split rule, entity-scoped overlays, etc.) are unchanged.

## 2. AI agents query the API, not the vector database directly

**This is the load-bearing rule of Phase 2.** External and internal AI agents access the catalog plane through HTTP APIs (or an MCP server wrapping those APIs) — never by querying the underlying vector database directly. The agent treats the catalog plane as a tool, not a data store.

Reasons:

- **Visibility enforcement.** The API applies the field-policy `visibility[]` filtering based on the agent's actor identity (`staff` / `customer` / `partner` / `supplier`). A customer-facing chatbot must not see staff-only fields; a partner agent must not see another tenant's overlays. Direct vector-DB access bypasses this entirely.
- **Overlay resolution.** The API returns the resolved CatalogEntry view (source projection + editorial overlays for the request's `locale, audience, market`). Direct vector-DB access typically returns either raw source projections or, worse, indexed documents whose overlay state is stale relative to the current resolver output.
- **Live-truth integration.** Volatile-live fields (current price, availability, hold) are fetched through source adapters at query time. Direct vector-DB access cannot reach them; the agent would receive embedded text plus stale indexed prices and have no path to live truth.
- **Audit and rate limiting.** API calls flow through Voyant's standard auth, audit, and rate-limiting layers. Direct DB access does not.
- **Stable contract.** The vector-DB schema is implementation detail of the IndexerAdapter (foundation §5.4.2) and changes without notice when the engine is swapped or upgraded. The API is a public contract.

The vector database is **infrastructure**, not a public surface. AI agents are clients of the catalog plane like any other client.

## 3. The AI access surface

Three surfaces, layered:

1. **`/v1/{admin,public}/{vertical}/search` with `mode: "semantic" | "hybrid" | "keyword"`** — the catalog plane's primary semantic-search endpoint, an extension of the Phase 1 search endpoint. Returns resolved CatalogEntry views (visibility-filtered, overlay-applied, locale-scoped) ranked by either keyword match, vector similarity, or a hybrid blend. This is the same endpoint storefronts and admin UIs use; AI agents are not special.
2. **A dedicated MCP (Model Context Protocol) server** wrapping the search and entity-retrieval APIs as MCP tools — `search_catalog`, `get_entity`, `suggest_alternatives`, `check_availability`, `get_quote`. AI agents (Claude, ChatGPT plugins, custom agents) connect to the MCP server with tenant-scoped credentials and call tools rather than crafting REST calls. Lives in `packages/catalog-rag/src/mcp/` or a sibling package; the architectural commitment is that the MCP tools wrap the same APIs, not the vector DB.
3. **Embeddings as opt-in API parameters.** When a caller wants to bring its own query embedding (an upstream agent that has already vectorized the user's intent), the API accepts a `query_embedding: number[]` parameter alongside `query: string`. The catalog plane uses whichever is provided; if both, it can blend.

The MCP server is a distinct module — vendor / agent ecosystem moves fast and deserves a clean seam — but it is a thin wrapper. All semantic capability lives in the underlying API.

## 4. Embeddings live in the search index

Vectors are stored alongside structured fields **in the search index**, not in a separate vector database. Typesense (the foundation doc's default per §5.4.1) supports vector fields natively and runs hybrid keyword+vector queries in a single request — that's a major reason it was chosen. Co-locating embeddings with index documents also means **source disconnection cleans up vectors automatically** — when a source is hard-disconnected (foundation §5.10) and its entities' index documents are removed, their embeddings disappear with them; there is no separate vector store to garbage-collect.

The `IndexerAdapter` contract (foundation §5.4.2) declares vector support through its `capabilities`:

- `supportsVectorFields: boolean` — does this engine store and query vectors?
- `supportsHybridSearch: boolean` — can it blend keyword and vector scores in one query?
- `vectorDimensions: number | null` — fixed dimensionality the engine expects (so embedding model has to match).
- `maxVectorsPerDocument: number | null` — some engines cap this.
- `supportsCrossAudienceFederation: boolean` — can the engine federate queries across multiple audience pools (collections / shards) and deduplicate by entity ID? (See §7.)

These flags are part of the Phase 1 contract surface so that Phase 2 lands without contract churn — Phase 1 deployments that don't run embeddings simply leave them at `false` / `null`.

Engines without vector support (e.g. Postgres FTS without pgvector) declare `supportsVectorFields: false`; the catalog plane falls back to keyword-only search and the agent surface returns a capability marker so callers know semantic queries are unavailable. Engines with separate vector stores (deployments using Postgres + a sidecar Qdrant, for example) implement an `IndexerAdapter` that internally federates the two stores; the catalog plane sees one engine.

## 5. What gets embedded

Each CatalogEntry has a small set of embedded fields, declared in the vertical's catalog-policy file. **Embedding selection is declared per-vertical in the catalog-policy file** as a sibling configuration to the field-policy registry — not as an additional attribute on the policy itself. This keeps the Phase 1 contract at 12 attributes and confines embedding-selection mechanics to Phase 2.

Default embedded content per vertical:

- **Title + summary + key descriptive fields**, concatenated into a single document-level embedding per `(entity, locale, audience, market)` tuple.
- **Per-locale, per-audience, per-market.** A French-speaking customer in the FR market hits French / customer / FR embeddings; a partner-audience agent hits partner-visible embeddings. Same `(locale, audience, market)` key as the rest of the search index.
- **Resolved view, not source raw.** Embeddings are computed against the overlay-resolved view, so editorial rewrites of titles and descriptions (which is what marketing wants ranked) are what gets embedded. Source raw text is not embedded.

What is **not** embedded:

- Volatile fields (price, availability) — change too often; embedding noise far exceeds signal.
- `managed` source identifiers, IDs, references, structured codes.
- Booking PII or customer-scoped fields.
- Internal-only fields (`visibility: ["staff"]`) when generating embeddings for non-staff-audience search documents.
- **Cross-audience denormalized text.** Even though admin search documents denormalize text fields across audiences for keyword matching (foundation §5.4.4), embeddings are **strictly per-audience** — the staff document's embedding covers staff-audience text only, the customer document's embedding covers customer-audience text only, and so on. Concatenating multiple audiences' text into one embedding produces semantic muddle that helps no one and creates real leakage risk (see §7).

If experience shows that per-field embeddings (separate vectors for "amenities" vs "neighborhood" vs "policies") materially improve relevance, Phase 2 can be extended — likely by promoting embedding selection to a field-policy attribute (the 13th) at that point. v1 of Phase 2 ships document-level embeddings only.

## 6. Embedding generation pipeline

Embedding generation runs on the **same triggers as reindex** (foundation §5.4 rule 3):

- Entity created → embed, write to index.
- Source projection updates a contributing field → re-embed.
- Editorial overlay changes a contributing field → re-embed (narrow scope: that `(locale, audience, market)` triple only).
- Referenced entity changes (per `referenced_by`) → re-embed parents that include the referenced entity's text in their embedded content.

Embedding generation is **asynchronous** — embedding APIs are slow (100ms–1s) and rate-limited. The reindex queue carries an `embedding_pending` flag; documents land in the index with their structured fields immediately and get their vectors written in a follow-up step. Searches that require vectors gracefully handle pending-embedding state (fall back to keyword-only for those documents in the result set).

The embedding model is configured per deployment, not hardcoded. The architecture follows the same provider pattern as storage / notifications / indexer:

```ts
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  capabilities: {
    modelId: string;            // e.g. "openai/text-embedding-3-small/v1"
    dimensions: number;
    maxTokensPerInput: number;
    maxBatchSize: number;
    supportedLanguages?: string[];  // null if multilingual / language-agnostic
  };
}
```

Phase 2 v1 ships:

- An OpenAI provider (`text-embedding-3-small` as default — cheap, good quality, multilingual).
- A Voyage AI provider (cleaner multilingual quality for non-English markets).
- A local-only option for air-gapped deployments (sentence-transformers via a small server).

Operators pick. The provider's vector dimensions must match the IndexerAdapter's declared `vectorDimensions`. Mismatch is a setup error, surfaced loudly at deployment.

## 7. Per-audience embedding pools and isolation guarantees

The same audience-scoped pattern that governs storefront search documents (foundation §5.4.4) governs embeddings — but with a sharper rule: **vectors do not denormalize across audiences, even on the admin side.** The admin search-document pattern denormalizes text fields for keyword matching; vectors stay strictly per-audience.

### 7.1. Why per-audience pools

Three risks if a single shared embedding pool serves both customer-facing and admin-facing AI agents:

1. **Leakage at retrieval time.** A customer chatbot authorized only for customer scope might receive top-K candidates whose vectors were trained on admin-facing text (internal notes, source aliases, supplier-only copy). Even if API-level visibility filtering blocks the doc from the response, the *ranking* has already been polluted by signal the customer should never have influenced. Per-audience pools eliminate this — the customer chatbot's nearest-neighbor search runs against vectors that only ever saw customer-visible content.
2. **Semantic muddle.** A single embedding over concatenated staff + customer + partner text averages three meanings into one vector. Cosine similarity stops being meaningful — neither the customer query nor the admin query gets a clean signal.
3. **Audit and compliance.** "Show me what content this AI agent had access to" is a real question. Per-audience pools give a trivially auditable answer: the customer agent only ever queries the customer pool; its blast radius is bounded by the pool's authorization and contents.

### 7.2. What the admin search document looks like

Admin documents carry denormalized text from other audiences (foundation §5.4.4) plus a single embedding over **staff-audience text only**:

```
admin document for entity prod_xxx (locale=en-GB, market=default):
  // text fields — denormalized across audiences for keyword search
  title:                <staff-audience resolved>
  customer_title:       <denormalized customer-audience overlay>
  partner_title:        <denormalized partner-audience overlay>   // if exists
  description:          <staff-audience resolved>
  customer_description: <denormalized customer-audience overlay>
  partner_description:  <denormalized partner-audience overlay>
  aliases:              ["BLI-WELL-7N-2026", "supplier-ref-12345", ...]

  // embedding — staff-audience text ONLY
  text_embedding:       [0.123, ..., 0.789]
```

Admin keyword search hits any of the text fields (so ops typing a SKU, marketing typing a storefront title, or CS typing a customer's words all surface the entity). Admin semantic search hits the staff embedding only.

### 7.3. How admin AI agents handle cross-audience semantic queries

The most common admin AI use case is "find me products similar to *X*" where *X* is described in customer-facing language ("Bali wellness retreat"). The staff-audience embedding may not match strongly — the staff text is `"BLI-WELL-7N-2026"` and the source title.

Solution: **staff actors are authorized to query any audience pool**, and the API supports an explicit pool-selection parameter. The admin AI agent declares which audience's semantic space it wants to match against:

```
POST /v1/admin/{vertical}/search
{
  "query": "Bali wellness retreat",
  "mode": "semantic",
  "search_audiences": ["customer"],
  "locale": "en-GB",
  "market": "default"
}
```

The query runs against the customer-audience pool; results come back as resolved CatalogEntries (with the requesting actor's visibility — staff sees full data, customer would only see customer-visible). Federation across multiple pools (`["customer", "partner"]`) is supported with deduplication by `entity_id` — same shape as the Tier 2 pricing rerank pattern (foundation §5.4.3), except across audiences instead of across sources.

Customer chatbots **cannot specify `search_audiences`**; their actor authorization pins them to `["customer"]`. Partner agents pinned to `["partner"]`. Supplier agents pinned to `["supplier"]`. The catalog plane enforces this at the API layer; agent code does not get to choose.

### 7.4. Customer-isolation guarantees

For a customer-facing chatbot, the architecture guarantees:

- The agent's actor identity is `customer`.
- Authorization pins `search_audiences` to `["customer"]`.
- The customer-audience embedding pool only ever contains text from customer-visible fields (per the field-policy `visibility[]` rule applied at index-build time).
- No staff field, partner field, supplier field, or internal alias has ever been embedded into a vector the customer agent can query.
- API responses are visibility-filtered too, but that's defense-in-depth — the leakage is already blocked at the retrieval layer.

The customer chatbot's blast radius is structurally limited to customer-visible content. There is no path — direct or indirect — by which it can influence its rankings using staff-only or partner-only signal.

For admin AI agents the guarantees invert: staff actor authorization grants access to all audience pools (with per-pool scope declared at query time); the staff document carries denormalized text for keyword search; the staff embedding is staff-only for clean semantic match against operational queries; cross-audience semantic queries are an explicit federated request.

## 8. Model versioning and re-embedding

Embedding models change. New models produce different vectors that aren't comparable to old ones. The architecture must handle the upgrade path explicitly:

- Each search-index document carries an `embedding_model_id` field (e.g. `"openai/text-embedding-3-small/v1"`).
- The deployment's active model is configuration; changing it does not silently re-embed.
- A migration tool — `bulkReindex` extended with `forceReembed: true` — re-embeds the entire catalog under the new model. This is a deliberate, observable operation; it is not automatic.
- During a model migration, the index can hold mixed-model vectors; queries scope to the active model and skip documents still on the old model. Once migration completes, old vectors are dropped.

This avoids the failure mode where a model upgrade silently degrades search quality across the catalog.

## 9. Operational concerns

A few things deployments will hit early and that the architecture should not pretend away:

- **Embedding cost.** OpenAI's `text-embedding-3-small` is roughly $0.02 per million tokens; for a catalog of 50k entries × 3 locales × 2 audiences × 1 market × ~500 tokens per document (the default-deployment shape per foundation §5.2.2), that's ~$0.60 for a full re-embed. Even at scale-stage shapes (5 locales × 4 audiences × 4 markets), the full re-embed runs in single-digit dollars. Drift detection plus narrow-scope re-embedding (only the changed `(locale, audience, market)` triple) keeps incremental cost negligible.
- **Latency budget for hybrid queries.** Typesense's hybrid search adds ~10–50ms over keyword-only. The catalog plane should expose this as observable and tune the keyword/vector score blend per vertical.
- **Tenant isolation for shared embedding models.** When multiple tenants share the same embedding API key, rate limits apply across all of them. The `EmbeddingProvider` contract should support per-tenant key override for high-volume deployments.

## 10. What Phase 2 ships vs what is deferred to Phase 2.x

**Phase 2 ships:**

- The architectural commitment that AI agents access via API/MCP, not direct DB.
- IndexerAdapter `capabilities` declaration including vector support flags.
- Native Typesense integration with vector field support and hybrid search.
- The `EmbeddingProvider` contract with default OpenAI, Voyage AI, and local-only providers.
- Per-vertical embedding selection in the vertical's catalog-policy file (sibling to field policy, not embedded in it).
- Async embedding generation in the reindex pipeline with `embedding_pending` handling.
- The `/v1/{admin,public}/{vertical}/search?mode=semantic|hybrid|keyword` API mode parameter.
- Per-audience embedding pools with strict isolation guarantees.

**Phase 2.x defers (additive, follow-up):**

- The MCP server itself. The architectural commitment is documented; the implementation may ship in a follow-up package once MCP's adoption stabilizes and the catalog API surface is exercised by real AI agents.
- Per-field embeddings (vs document-level). Phase 2 emits one embedding per `(entity, locale, audience, market)`; per-field embeddings (e.g. separate vectors for "amenities" vs "neighborhood") are an obvious extension when measured retrieval quality demands it. Likely promotes `embed` to a 13th field-policy attribute at that point.
- Re-ranking with cross-encoders. Vector retrieval gives a candidate set; cross-encoder rerankers improve quality at latency cost. Same staging pattern as Tier 2 pricing rerank (foundation §5.4.3); not Phase 2.
- Long-tail embedding providers (Cohere, voyage-3-large, BGE, local sentence-transformers beyond a single default). Adding providers is mechanical; not blocking.

## 11. Package layout

```
packages/catalog-rag                  Phase 2 RAG package (separate from catalog foundation):
  src/embeddings/
    contract.ts                       EmbeddingProvider contract
    openai.ts                         default OpenAI provider
    voyage.ts                         Voyage AI provider
    local.ts                          local sentence-transformers provider
  src/pipeline/
    generate.ts                       async embedding generation in the reindex pipeline
    model-registry.ts                 embedding_model_id tracking + migration helpers
  src/search/
    semantic.ts                       semantic / hybrid search orchestration over the IndexerAdapter
    federate.ts                       cross-audience federated query helper
  src/mcp/                            MCP server scaffolding; ships in Phase 2.x
    contract.ts                       MCP tool definitions
    server.ts                         MCP server entry point
```

Phase 1's `packages/catalog` does not gain embeddings code; that lives entirely in `packages/catalog-rag`. Templates that want semantic search add this dependency; templates that don't, skip it.

## 12. Open questions

1. **MCP server packaging and shipping cadence.** §3 commits to AI agents accessing the catalog through an MCP server wrapping the APIs. Whether this ships in `packages/catalog-rag/src/mcp/` or as a separate `@voyantjs/voyant-catalog-mcp` package, and whether it lands within Phase 2 or in a Phase 2.x follow-up, depends on how fast the MCP ecosystem stabilizes and whether real AI-agent integrations land within the Phase 2 release window.
2. **Per-field vs document-level embeddings.** Phase 2 emits one embedding per `(entity, locale, audience, market)` covering title + summary + key descriptive fields. Real retrieval-quality measurement may show that separate embeddings per field group materially improve relevance. If promoted, embedding selection likely becomes a 13th field-policy attribute (`embed: true`).
3. **Cross-encoder rerankers for semantic search.** Mirror of the Tier 2 pricing rerank pattern (foundation §5.4.3) — vector retrieval narrows, a cross-encoder reranks the top-N for quality. Worth real measurement before committing latency budget; not Phase 2.
4. **Embedding provider coverage for non-English markets.** OpenAI's `text-embedding-3-small` is multilingual but quality varies by language. Voyage AI ships better non-English models. Worth measuring per-locale retrieval quality before locking the default.
5. **Per-tenant embedding keys for SaaS-style multi-tenant operators.** The `EmbeddingProvider` contract should support tenant-scoped key override; specifics deferred until a multi-tenant operator hits rate limits.

## 13. Glossary (Phase 2-specific)

- **Embedding** — a fixed-dimension vector representation of a CatalogEntry's text content, used for semantic similarity search.
- **`EmbeddingProvider`** — the swappable contract for generating embeddings. Default implementations: OpenAI, Voyage AI, local sentence-transformers. Operator-specific providers can be implemented and registered.
- **Embedding pool** — the set of embeddings for a particular `(vertical, locale, audience, market)` combination. Strictly per-audience for isolation guarantees.
- **Hybrid search** — a single query that blends keyword matching and vector similarity. Typesense and Algolia support it natively.
- **MCP (Model Context Protocol)** — the standard for exposing tools and data to AI agents. Voyant's catalog MCP server wraps the search and entity-retrieval APIs.
- **Re-embedding** — regenerating vectors when contributing fields change or when migrating to a new embedding model.

## 14. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — the Phase 1 foundation. Phase 2 depends on its IndexerAdapter contract, overlay store, and field-policy registry.
- [`catalog-flights-architecture.md`](./catalog-flights-architecture.md) — the Phase 3 flights vertical. Flights explicitly opt out of embeddings (vector search over flights provides no real user value); see §5.11.5 of the foundation doc and §5 of the flights doc.
