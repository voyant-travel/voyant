import { z } from "zod"

export const messageAddressSchema = z.object({
  address: z.string().email(),
  name: z.string().trim().min(1).nullable().optional(),
})

export const inboundAttachmentSchema = z.object({
  externalId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  privateHandle: z.string().min(1),
  inlineContentId: z.string().min(1).nullable().optional(),
})

export const inboundEmailEnvelopeV1Schema = z.object({
  version: z.literal("1"),
  sourceId: z.string().min(1),
  externalEnvelopeId: z.string().min(1),
  externalMessageId: z.string().min(1),
  sender: messageAddressSchema,
  to: z.array(messageAddressSchema).min(1),
  cc: z.array(messageAddressSchema).default([]),
  replyTo: z.array(messageAddressSchema).default([]),
  subject: z.string().nullable(),
  text: z.string().nullable(),
  html: z.string().nullable(),
  attachments: z.array(inboundAttachmentSchema).default([]),
  classification: z
    .enum(["message", "automatic_reply", "delivery_status", "complaint", "suspicious"])
    .default("message"),
  threading: z.object({
    messageId: z.string().min(1).nullable(),
    inReplyTo: z.string().min(1).nullable(),
    references: z.array(z.string().min(1)).default([]),
  }),
  occurredAt: z.string().datetime({ offset: true }),
})

export type InboundEmailEnvelopeV1 = z.infer<typeof inboundEmailEnvelopeV1Schema>
export type InboundAttachment = z.infer<typeof inboundAttachmentSchema>

export interface IngressItemRef {
  id: string
}

export interface IngressListPage {
  items: readonly IngressItemRef[]
  cursor?: string
}

/**
 * Provider-neutral pull boundary. A source retains an item until `ack` returns,
 * so committing an envelope and crashing before acknowledgement is safe.
 */
export interface ConversationIngressSource {
  readonly id: string
  list(input: { cursor?: string; limit: number }): Promise<IngressListPage>
  fetch(ref: IngressItemRef): Promise<InboundEmailEnvelopeV1>
  ack(ref: IngressItemRef): Promise<void>
}

export interface ConversationRenderedServiceMessage {
  channelAccountId: string
  target: { type: "@voyant-travel/conversations#part"; id: string }
  purpose: "conversation-reply"
  idempotencyKey: string
  to: string
  subject?: string
  text?: string
  sanitizedHtml?: string
  attachments?: ReadonlyArray<{
    privateHandle: string
    filename: string
    contentType: string
    disposition: "attachment" | "inline"
    contentId?: string
  }>
  thread: { threadId: string; replyToDeliveryId?: string }
  metadata: {
    replyAlias: string
    inReplyTo: string | null
    references: readonly string[]
  }
}

export interface ConversationMessageAdmissionResult {
  deliveryId: string
  state:
    | "pending"
    | "accepted"
    | "delivered"
    | "failed"
    | "bounced"
    | "complained"
    | "suppressed"
    | "cancelled"
}

/** Notifications implements this consumer contract on the caller's transaction. */
export interface ConversationsRenderedMessageAdmission {
  admitRenderedServiceMessage(
    db: unknown,
    message: ConversationRenderedServiceMessage,
    context?: { bindings?: unknown },
  ): Promise<ConversationMessageAdmissionResult>
}

export interface ConversationPrivateAttachmentDeliveryResolver {
  resolveForDelivery(input: {
    targetId: string
    privateHandle: string
    filename: string
    contentType?: string
    disposition?: "attachment" | "inline"
    contentId?: string
  }): Promise<{
    filename: string
    contentType: string
    disposition: "attachment" | "inline"
    contentId?: string
    contentBase64?: string
    path?: string
  }>
}

/** Stable, order-independent JSON used to detect replay payload drift. */
export function canonicalEnvelopePayload(envelope: InboundEmailEnvelopeV1): string {
  return canonicalJson(inboundEmailEnvelopeV1Schema.parse(envelope))
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

/** Canonical comparison form for RFC message identifiers. */
export function canonicalMessageId(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed.slice(1, -1).trim().toLowerCase()
    : trimmed.toLowerCase()
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase()
}
