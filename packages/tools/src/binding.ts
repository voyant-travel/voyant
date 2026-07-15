import type { RiskPolicy, RiskTier } from "./risk.js"

export type ToolAudience = "staff" | "customer" | "partner" | "supplier"

/**
 * Audience is resolved from the authenticated grant. `allowed` narrows which
 * grant audiences may discover and call the tool; omitting it allows every
 * authenticated audience while still carrying the grant-derived resolver
 * scope into the handler.
 */
export interface ToolAudiencePolicy {
  source: "grant"
  allowed?: readonly ToolAudience[]
}

/** Standard MCP ToolAnnotations hints. Exact authorization and risk remain in Voyant metadata. */
export interface ToolAnnotations {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

/** Compatibility metadata for a capability scheduled for removal or replacement. */
export interface ToolDeprecation {
  /** Capability version at which deprecation began. */
  sinceVersion: string
  message: string
  replacementCapabilityId?: string
  /** ISO-8601 calendar date after which the capability may be removed. */
  sunsetDate?: string
}

/** Deployment/action-ledger risk posture from the selected package graph. */
export type ToolDeploymentRisk = "low" | "medium" | "high" | "critical"

/** Stable identity supplied by a package graph binding or directly by a standalone tool. */
export interface ToolBindingMetadata {
  capabilityId: string
  owner: string
  capabilityVersion: string
  /** Duplicated declaration fields are checked against the runtime definition. */
  name?: string
  requiredScopes?: readonly string[]
  deploymentRisk?: ToolDeploymentRisk
  aliases?: readonly string[]
  deprecation?: ToolDeprecation
  audience?: ToolAudiencePolicy
  annotations?: ToolAnnotations
}

/**
 * A single tool as advertised on the discovery manifest — pure data a remote
 * agent client can read to discover, gate, and (later) invoke the tool over the
 * wire. This is what `ToolRegistry.list()` returns and what the MCP transport
 * maps into `tools/list`.
 */
export interface ToolManifestEntry {
  /** Stable package capability identity, independent of the invocation name. */
  capabilityId: string
  /** Package/module that owns the capability. */
  owner: string
  /** Version of the capability contract, independent of the manifest contract version. */
  capabilityVersion: string
  name: string
  description: string
  /** Deprecated invocation names accepted for compatibility but not treated as identities. */
  aliases: readonly string[]
  deprecation?: ToolDeprecation
  /** JSON Schema (draft 2020-12) for the tool input, from `z.toJSONSchema`. */
  inputSchema: Record<string, unknown>
  /** JSON Schema (draft 2020-12) for the typed pure-data result. */
  outputSchema: Record<string, unknown>
  /** Scopes required to call the tool (AND semantics), `resource:action` form. */
  requiredScopes: readonly string[]
  /** Grant-derived audience policy used for discovery and invocation. */
  audience: ToolAudiencePolicy
  /** Graph/action-ledger risk posture, checked for compatibility with `tier`. */
  deploymentRisk: ToolDeploymentRisk
  tier: RiskTier
  riskPolicy: RiskPolicy
  /** Standard MCP hints derived from risk, with explicit tool overrides applied. */
  annotations: ToolAnnotations
}

/** Version of the manifest contract, carried so consumers degrade gracefully. */
export const TOOL_CONTRACT_VERSION = "2026-07-15" as const

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
