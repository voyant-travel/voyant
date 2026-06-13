/**
 * Transport-agnostic registry for trip-composer agent tools.
 */

import type { z } from "zod"

import type { McpToolContext, McpToolDefinition, McpToolResult } from "./mcp-contract.js"
import { McpToolError } from "./mcp-contract.js"

export interface McpToolRegistry {
  /** The context used for all tool dispatches in this registry. */
  readonly context: McpToolContext
  /** Register a tool definition. Throws on duplicate name. */
  register<TArgs>(tool: McpToolDefinition<TArgs, McpToolResult>): void
  /** List registered tool names — useful for the MCP `ListTools` request. */
  list(): McpToolListEntry[]
  /** Dispatch a tool call by name. Validates args with the tool's zod schema. */
  dispatchTool(name: string, args: unknown): Promise<McpToolResult>
  /** Look up a registered tool. Returns `undefined` if not registered. */
  // biome-ignore lint/suspicious/noExplicitAny: registry is heterogeneous over args -- owner: trip-composer; existing suppression is intentional pending typed cleanup.
  get(name: string): McpToolDefinition<any, McpToolResult> | undefined
}

export interface McpToolListEntry {
  name: string
  description: string
  /**
   * Zod schema serialized as a placeholder JSON Schema. Templates that
   * need actual JSON Schema for the MCP SDK should call `zod-to-json-schema`
   * (or equivalent) on the tool's `inputSchema` before publishing.
   */
  inputSchemaPreview: { type: "object"; description: string }
}

export interface CreateMcpToolRegistryOptions {
  context: McpToolContext
}

export function createMcpToolRegistry(options: CreateMcpToolRegistryOptions): McpToolRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool args -- owner: trip-composer; existing suppression is intentional pending typed cleanup.
  const tools = new Map<string, McpToolDefinition<any, McpToolResult>>()

  return {
    get context() {
      return options.context
    },
    register(tool) {
      if (tools.has(tool.name)) {
        throw new Error(`MCP tool "${tool.name}" is already registered`)
      }
      tools.set(tool.name, tool)
    },
    list(): McpToolListEntry[] {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchemaPreview: {
          type: "object",
          description: "Use the package's zod-to-json-schema adapter to serialize for the MCP SDK.",
        },
      }))
    },
    get(name) {
      return tools.get(name)
    },
    async dispatchTool(name, args): Promise<McpToolResult> {
      const tool = tools.get(name)
      if (!tool) {
        return errorResult(
          `MCP tool "${name}" is not registered. Known tools: ${Array.from(tools.keys()).join(", ") || "(none)"}`,
          "NOT_FOUND",
        )
      }

      let parsed: unknown
      try {
        parsed = tool.inputSchema.parse(args)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return errorResult(`Invalid input for tool "${name}": ${message}`, "INVALID_INPUT")
      }

      try {
        return await tool.handler(parsed, options.context)
      } catch (err) {
        if (err instanceof McpToolError) {
          return errorResult(err.message, err.code, err.meta)
        }
        const message = err instanceof Error ? err.message : String(err)
        return errorResult(`Tool "${name}" failed: ${message}`, "PROVIDER_ERROR")
      }
    },
  }
}

function errorResult(message: string, code: string, meta?: Record<string, unknown>): McpToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `[${code}] ${message}` }],
    structuredContent: { error: { code, message, ...(meta ?? {}) } },
  }
}

/**
 * Helper for tools to assert that a required service was injected
 * into the context. Throws `MISSING_SERVICE` if not, which the dispatcher
 * translates into a structured error.
 */
export function requireService<T>(service: T | undefined, name: string): T {
  if (!service) {
    throw new McpToolError(
      `MCP tool requires the "${name}" service to be wired into the context, but it was not provided. Configure the registry services or omit tools that depend on it.`,
      "MISSING_SERVICE",
      { service: name },
    )
  }
  return service
}

/**
 * Helper for tools that need to enforce per-actor authorization. Customer/
 * partner/supplier actors are pinned to their own audience pool — staff
 * actors may federate across pools.
 */
export function enforceAudienceAuthorization(
  actor: McpToolContext["actor"],
  requestedAudiences?: string[],
): void {
  if (!requestedAudiences || requestedAudiences.length === 0) return
  if (actor === "staff") return
  if (requestedAudiences.length === 1 && requestedAudiences[0] === actor) return
  throw new McpToolError(
    `Actor "${actor}" is not authorized to query audiences ${JSON.stringify(requestedAudiences)}. Non-staff actors may only query their own audience pool.`,
    "AUTHORIZATION_DENIED",
    { actor, requestedAudiences },
  )
}

// Re-export zod for tool authors who want to define schemas without
// adding a separate dep.
export type { z }
