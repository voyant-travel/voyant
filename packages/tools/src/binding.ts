import type { RiskPolicy, RiskTier } from "./risk.js"

/**
 * A single tool as advertised on the discovery manifest — pure data a remote
 * agent client can read to discover, gate, and (later) invoke the tool over the
 * wire. This is what `ToolRegistry.list()` returns and what the MCP transport
 * maps into `tools/list`.
 */
export interface ToolManifestEntry {
  name: string
  description: string
  /** JSON Schema (draft 2020-12) for the tool input, from `z.toJSONSchema`. */
  inputSchema: Record<string, unknown>
  /** Scopes required to call the tool (AND semantics), `resource:action` form. */
  requiredScopes: readonly string[]
  tier: RiskTier
  riskPolicy: RiskPolicy
}

/** Version of the manifest contract, carried so consumers degrade gracefully. */
export const TOOL_CONTRACT_VERSION = "2026-07-01" as const

/**
 * A tool reachable over a versioned remote protocol rather than dispatched
 * in-process (design decision D1). Modeled now; remote proxying lands later.
 */
export interface RemoteToolRef extends ToolManifestEntry {
  /** Base URL of the remote tool server exposing the manifest + invocation. */
  baseUrl: string
  /** Whether to forward the caller's auth to the remote server. */
  forwardAuth: boolean
}
