/**
 * Transport-agnostic tool contract for trips agent commands.
 *
 * Catalog agent access now goes through the catalog HTTP APIs directly; this
 * small contract remains only for the trips command tools exposed by
 * operator runtimes.
 */

import type { ResolverScope, Visibility } from "@voyant-travel/catalog"
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
