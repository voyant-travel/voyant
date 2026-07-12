import type { z } from "zod"

import type { ToolContext } from "./context.js"
import type { RiskPolicy, RiskTier } from "./risk.js"

/**
 * A transport-neutral, headless tool definition. The handler returns **typed
 * pure data** validated by `outputSchema` — no transport envelopes, no
 * presentation. Exposure (MCP, remote agent, HTTP) is a thin adapter over this.
 *
 * @typeParam In - the parsed input type (from `inputSchema`).
 * @typeParam Out - the pure-data output type (validated by `outputSchema`).
 * @typeParam Ctx - the context type; domains widen it by intersection to inject
 *   services, e.g. `ToolContext & { trips: TripsToolServices }`.
 */
export interface ToolDefinition<In, Out, Ctx extends ToolContext = ToolContext> {
  /** Tool name surfaced to the agent. Convention: snake_case. */
  name: string
  /** Human-readable description shown to the agent. */
  description: string
  /**
   * Zod schema validating + typing the args. Keep it serialization-friendly
   * (avoid top-level `.transform()`/`.refine()`) so `z.toJSONSchema` can emit a
   * faithful manifest for remote consumers.
   */
  inputSchema: z.ZodType<In>
  /** Zod schema validating the handler's return value (pure data). */
  outputSchema: z.ZodType<Out>
  /**
   * Scopes required to call this tool, in `resource:action` form (from
   * the selected deployment graph's access declarations. Enforced by
   * the transport with AND semantics — the caller must hold **all** of them.
   */
  requiredScopes: readonly string[]
  /** Coarse risk tier. */
  tier: RiskTier
  /** Declarative risk policy (destructive / reversible / dry-run / side effects). */
  riskPolicy: RiskPolicy
  /** The implementation — receives parsed args + context, returns pure data. */
  handler(args: In, ctx: Ctx): Promise<Out>
}

/**
 * Identity helper that defines a tool while preserving its generics. Purely for
 * ergonomics + inference; returns the definition unchanged.
 */
export function defineTool<In, Out, Ctx extends ToolContext = ToolContext>(
  def: ToolDefinition<In, Out, Ctx>,
): ToolDefinition<In, Out, Ctx> {
  return def
}
