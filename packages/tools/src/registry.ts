import { z } from "zod"

import type { ToolManifestEntry } from "./binding.js"
import type { ToolContext } from "./context.js"
import type { ToolDefinition } from "./define-tool.js"
import { ToolError } from "./errors.js"

// biome-ignore lint/suspicious/noExplicitAny: the registry is a heterogeneous container over each tool's distinct input/output/context types.
type AnyToolDefinition = ToolDefinition<any, any, any>

/**
 * Transport-neutral registry of headless tools. Any domain package registers a
 * tool array here (mirroring how modules mount routes); a transport adapter
 * enumerates `list()` and dispatches by name. Authorization is **not** enforced
 * here — that stays in the transport, bound to each tool's `requiredScopes`.
 */
export interface ToolRegistry {
  /** Register a tool. Throws on duplicate name. */
  register(def: AnyToolDefinition): void
  /** Register many tools. */
  registerAll(defs: readonly AnyToolDefinition[]): void
  /** Look up a registered tool by name. */
  get(name: string): AnyToolDefinition | undefined
  /** All registered tool names. */
  names(): string[]
  /** The discovery manifest — pure data for `tools/list` and remote consumers. */
  list(): ToolManifestEntry[]
  /**
   * Dispatch a tool by name: validate args against `inputSchema`, run the
   * handler, validate the result against `outputSchema`, return pure data.
   * Throws {@link ToolError} on unknown tool / invalid input / invalid output /
   * handler failure.
   */
  dispatch<Out = unknown>(name: string, args: unknown, ctx: ToolContext): Promise<Out>
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, AnyToolDefinition>()

  return {
    register(def) {
      if (tools.has(def.name)) {
        throw new Error(`Tool "${def.name}" is already registered`)
      }
      tools.set(def.name, def)
    },
    registerAll(defs) {
      for (const def of defs) this.register(def)
    },
    get(name) {
      return tools.get(name)
    },
    names() {
      return Array.from(tools.keys())
    },
    list() {
      return Array.from(tools.values()).map(toManifestEntry)
    },
    async dispatch(name, args, ctx) {
      const tool = tools.get(name)
      if (!tool) {
        throw new ToolError(
          `Tool "${name}" is not registered. Known tools: ${Array.from(tools.keys()).join(", ") || "(none)"}`,
          "NOT_FOUND",
          { name },
        )
      }

      const input = tool.inputSchema.safeParse(args)
      if (!input.success) {
        throw new ToolError(
          `Invalid input for tool "${name}": ${input.error.message}`,
          "INVALID_INPUT",
          {
            issues: input.error.issues,
          },
        )
      }

      let result: unknown
      try {
        result = await tool.handler(input.data, ctx)
      } catch (err) {
        if (err instanceof ToolError) throw err
        const message = err instanceof Error ? err.message : String(err)
        throw new ToolError(`Tool "${name}" failed: ${message}`, "PROVIDER_ERROR")
      }

      const output = tool.outputSchema.safeParse(result)
      if (!output.success) {
        throw new ToolError(
          `Tool "${name}" returned output that failed its outputSchema: ${output.error.message}`,
          "INVALID_OUTPUT",
          { issues: output.error.issues },
        )
      }
      return output.data as never
    },
  }
}

function toManifestEntry(tool: AnyToolDefinition): ToolManifestEntry {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: toInputJsonSchema(tool),
    requiredScopes: tool.requiredScopes,
    tier: tool.tier,
    riskPolicy: tool.riskPolicy,
  }
}

/**
 * Serialize a tool's `inputSchema` to JSON Schema via zod v4's native
 * `z.toJSONSchema`. A non-serializable schema (e.g. a top-level transform)
 * degrades to a permissive object rather than breaking the whole manifest.
 */
function toInputJsonSchema(tool: AnyToolDefinition): Record<string, unknown> {
  try {
    return z.toJSONSchema(tool.inputSchema) as Record<string, unknown>
  } catch {
    return {
      type: "object",
      description: `Input schema for "${tool.name}" is not JSON-Schema-serializable; validated server-side.`,
      additionalProperties: true,
    }
  }
}
