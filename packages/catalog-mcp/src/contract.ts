/**
 * MCP tool contract — transport-agnostic shapes for catalog tools.
 *
 * Every catalog tool is defined as a `McpToolDefinition`: a name, a
 * description (shown to the LLM), an input zod schema, and a handler that
 * takes the parsed args + the per-request context and returns a structured
 * result.
 *
 * Templates wire the registry into the actual MCP transport of their
 * choice (the `@modelcontextprotocol/sdk` for stdio/HTTP+SSE, a custom
 * Hono route, etc.). This package's surface ends at the tool definitions.
 *
 * See `docs/architecture/catalog-rag-architecture.md` §3 + §12.
 */

import type {
  IndexerAdapter,
  IndexerSlice,
  ResolverScope,
  Visibility,
} from "@voyantjs/voyant-catalog"
import type { EmbeddingProvider } from "@voyantjs/voyant-catalog-rag"
import type { z } from "zod"

/**
 * Per-request context passed to every tool handler.
 *
 * Templates construct this once per agent connection (typically derived
 * from the agent's API key / OAuth token / session). The MCP transport
 * passes the same context to every tool dispatch in that session.
 */
export interface McpToolContext {
  /** The actor identity. Drives visibility filtering at every layer. */
  actor: Visibility
  /** Tenant / operator identifier — usually synthesized into provenance. */
  tenantId: string
  /** Default scope for tools that need locale / audience / market. */
  defaultScope: ResolverScope
  /** Catalog services / adapters injected by the template. */
  catalog: McpCatalogServices
}

/**
 * The catalog plane services tools call into. Templates inject the
 * concrete instances (e.g. the IndexerAdapter, the EmbeddingProvider, the
 * per-vertical resolved-fetch helpers) at registry construction time.
 *
 * Each service is optional — tools that need a service it isn't given
 * fail with a clear error rather than producing wrong results silently.
 */
export interface McpCatalogServices {
  /** Indexer for keyword / hybrid / semantic search. */
  indexer?: IndexerAdapter
  /** Embedding provider — required for semantic / hybrid search. */
  embeddings?: EmbeddingProvider
  /**
   * Per-vertical resolved-fetch functions, keyed by vertical name. Each
   * takes (entityId, scope) and returns the resolved view or null. Used
   * by `get_entity` and `suggest_alternatives`.
   */
  resolveEntity?: (
    vertical: string,
    entityId: string,
    scope: ResolverScope,
  ) => Promise<McpResolvedEntity | null>
  /**
   * Per-vertical live-availability function — calls the source adapter
   * for volatile-live availability fields. Used by `check_availability`.
   */
  checkAvailability?: (
    vertical: string,
    entityId: string,
    parameters: Record<string, unknown>,
  ) => Promise<McpAvailabilityResult>
  /**
   * Per-vertical live-quote function — calls the source adapter to lock
   * a priced quote. Used by `get_quote`.
   */
  getQuote?: (
    vertical: string,
    entityId: string,
    parameters: Record<string, unknown>,
  ) => Promise<McpQuoteResult>
  /**
   * Default slice resolver. Given a vertical + the context's defaultScope,
   * returns the IndexerSlice the tool should query. Templates may override
   * this to map their own audience taxonomy to slices.
   */
  defaultSliceFor?: (vertical: string, scope: ResolverScope) => IndexerSlice
}

/** Resolved-view shape returned by `get_entity` and similar. */
export interface McpResolvedEntity {
  vertical: string
  entityId: string
  /** Resolved field values (visibility-filtered for the actor). */
  fields: Record<string, unknown>
  /** Sources / provenance — which slice satisfied each overlayed field. */
  provenance?: Record<string, { locale: string; audience: string; market: string } | null>
}

/** Live-availability response shape — exact shape is vertical-dependent. */
export interface McpAvailabilityResult {
  available: boolean
  /** Optional structured details (room counts, departure capacity, etc.). */
  details?: Record<string, unknown>
  /** When the availability was checked — useful for UX timestamps. */
  checkedAt: string
}

/** Live-quote response shape. */
export interface McpQuoteResult {
  quoteId: string
  totalPrice: { amount: string; currency: string }
  /** When the quote expires — agents should warn users about this. */
  expiresAt?: string
  /** Optional structured breakdown — base / taxes / fees / surcharges. */
  breakdown?: Record<string, unknown>
}

/**
 * MCP tool definition. The name + description are surfaced to the LLM;
 * `inputSchema` validates and types the args; `handler` is the actual
 * implementation.
 *
 * MCP standardly uses JSON Schema for inputSchema; we use Zod here and
 * the registry helper exports a `toJsonSchema` adapter consumers wire
 * into their MCP transport.
 */
export interface McpToolDefinition<TArgs = unknown, TResult = McpToolResult> {
  /** Tool name, surfaced to the LLM. Convention: snake_case. */
  name: string
  /** Human-readable description shown to the LLM. */
  description: string
  /** Zod schema for the args; the dispatcher parses + validates. */
  inputSchema: z.ZodType<TArgs>
  /** Handler — receives parsed args + context, returns the result. */
  handler: McpToolHandler<TArgs, TResult>
}

export type McpToolHandler<TArgs, TResult> = (
  args: TArgs,
  context: McpToolContext,
) => Promise<TResult>

/**
 * Standard MCP tool result envelope. Mirrors MCP's `CallToolResult` shape:
 * a `content` array of typed items (text, structured data) plus an optional
 * `isError` flag for soft errors that the LLM should see.
 */
export interface McpToolResult {
  content: McpToolContent[]
  isError?: boolean
  /**
   * Optional structured data the LLM can act on programmatically. Mirrors
   * the MCP SDK's `structuredContent` field.
   */
  structuredContent?: Record<string, unknown>
}

export type McpToolContent =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string } }

/**
 * Standard error class for tool failures. The dispatcher catches these
 * and translates them into MCP's standard error envelope.
 */
export class McpToolError extends Error {
  constructor(
    message: string,
    public readonly code: McpToolErrorCode,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "McpToolError"
  }
}

export type McpToolErrorCode =
  | "MISSING_SERVICE"
  | "AUTHORIZATION_DENIED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "PROVIDER_ERROR"
