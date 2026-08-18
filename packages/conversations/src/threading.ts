import {
  canonicalMessageId,
  normalizeE164,
  normalizeEmailAddress,
} from "@voyant-travel/conversations-contracts"

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

export const SMS_RECENTLY_CLOSED_REOPEN_DAYS = 30

/** Account identity is part of the key: two local numbers never share an SMS thread. */
export function smsConversationPairKey(channelAccountId: string, remoteAddress: string): string {
  return `${channelAccountId}\u0000${normalizeE164(remoteAddress)}`
}

export function isSmsConversationRecentlyClosed(closedAt: Date, inboundAt: Date): boolean {
  const age = inboundAt.getTime() - closedAt.getTime()
  return age >= 0 && age <= SMS_RECENTLY_CLOSED_REOPEN_DAYS * 24 * 60 * 60 * 1_000
}
