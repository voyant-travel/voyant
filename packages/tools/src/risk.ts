/**
 * Declarative risk metadata for a tool (design decision D1).
 *
 * Risk/confirmation is **data on the manifest**, not an in-process predicate, so
 * a remote agent client and the MCP layer can enforce approval gates without
 * executing tool code. Where a real preview is needed, expose it as a separate
 * classify/preview tool rather than a serialized function.
 */

export const RISK_TIERS = ["read", "write", "sensitive", "destructive"] as const

/**
 * Coarse risk tier:
 * - `read` — no state change.
 * - `write` — creates/updates reversible state.
 * - `sensitive` — exposes or handles PII / privileged data.
 * - `destructive` — irreversible or externally-committing (payment, booking).
 */
export type RiskTier = (typeof RISK_TIERS)[number]

export const TOOL_SIDE_EFFECTS = [
  "payment",
  "refund",
  "email",
  "sms",
  "push",
  "external-booking",
  "data-write",
  "data-delete",
] as const

export type ToolSideEffect = (typeof TOOL_SIDE_EFFECTS)[number]

/** Declarative risk policy carried on the tool manifest. */
export interface RiskPolicy {
  /** Whether the tool commits an irreversible or externally-visible change. */
  destructive: boolean
  /** Whether the effect can be undone by a later tool call. */
  reversible: boolean
  /** Whether the tool offers a dry-run preview mode. */
  dryRunSupported: boolean
  /** Whether a client should require explicit user confirmation before calling. */
  confirmationRequired?: boolean
  /** The categories of side effect this tool may produce. */
  sideEffects?: readonly ToolSideEffect[]
}

/** A conventional read-only, side-effect-free risk policy. */
export const READ_ONLY_RISK: RiskPolicy = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
}
