import type {
  ActionLedgerCapabilityApprovalPolicy,
  ActionLedgerCapabilityRisk,
} from "./capability.js"

export function canonicalize(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(canonicalize)

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key])
  }
  return sorted
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export async function sha256(value: unknown): Promise<string> {
  const text = canonicalJson(value)
  const bytes = new TextEncoder().encode(text)
  const digest = await getCrypto().subtle.digest("SHA-256", bytes)
  return bytesToHex(new Uint8Array(digest))
}

export async function buildIdempotencyFingerprint(input: {
  actionName: string
  actionVersion: string
  targetType: string
  targetId: string
  commandInput?: unknown
  policyInputs?: unknown
}): Promise<string> {
  return `sha256:${await sha256(input)}`
}

export interface BuildActionApprovalCommandFingerprintInput {
  actionName: string
  actionVersion: string
  targetType: string
  targetId: string
  commandInput?: unknown
  approvalPolicy: ActionLedgerCapabilityApprovalPolicy
  capabilityId: string
  capabilityVersion: string
  evaluatedRisk: ActionLedgerCapabilityRisk
  reasonCode: string | null
  createdTarget?: {
    canonicalTargetType: string
    resultReferenceType: string
  } | null
}

export async function buildActionApprovalCommandFingerprint(
  input: BuildActionApprovalCommandFingerprintInput,
): Promise<string> {
  return buildIdempotencyFingerprint({
    actionName: input.actionName,
    actionVersion: input.actionVersion,
    targetType: input.targetType,
    targetId: input.targetId,
    commandInput: input.commandInput ?? null,
    policyInputs: {
      approvalPolicy: input.approvalPolicy,
      capabilityId: input.capabilityId,
      capabilityVersion: input.capabilityVersion,
      evaluatedRisk: input.evaluatedRisk,
      reasonCode: input.reasonCode,
      ...(input.createdTarget ? { createdTarget: input.createdTarget } : {}),
    },
  })
}

function getCrypto(): Crypto {
  const crypto = (globalThis as { crypto?: Crypto }).crypto
  if (!crypto?.subtle) {
    throw new Error(
      "@voyant-travel/action-ledger: globalThis.crypto.subtle is required for idempotency fingerprints.",
    )
  }
  return crypto
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ""
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0")
  }
  return out
}
