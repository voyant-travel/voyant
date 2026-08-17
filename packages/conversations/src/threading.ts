import { canonicalMessageId, normalizeEmailAddress } from "@voyant-travel/conversations-contracts"

export class ConversationThreadConflictError extends Error {
  readonly code = "ambiguous_thread"
}

/** Subject is intentionally absent: only exact aliases and threading identifiers participate. */
export function selectExactConversation(input: {
  aliasMatches: readonly string[]
  headerMatches: readonly string[]
}): string | null {
  const matches = new Set([...input.aliasMatches, ...input.headerMatches])
  if (matches.size > 1)
    throw new ConversationThreadConflictError("Exact thread identities disagree")
  return matches.values().next().value ?? null
}

export function inboundThreadIds(input: {
  inReplyTo: string | null
  references: readonly string[]
}): string[] {
  return [
    ...new Set(
      [input.inReplyTo, ...input.references]
        .filter((value): value is string => !!value)
        .map(canonicalMessageId),
    ),
  ]
}

export function createReplyAlias(conversationId: string, receivingAddress: string): string {
  const normalized = normalizeEmailAddress(receivingAddress)
  const separator = normalized.lastIndexOf("@")
  if (separator <= 0)
    throw new Error("Cannot derive a reply alias from an invalid receiving address")
  return `${normalized.slice(0, separator)}+${conversationId}@${normalized.slice(separator + 1)}`
}
