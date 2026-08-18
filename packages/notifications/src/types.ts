/**
 * Channel over which a notification is delivered. Built-in channels are
 * `"email"` and `"sms"`, but providers may declare additional channel
 * identifiers (e.g. `"slack"`, `"push"`).
 */
export type NotificationChannel = "email" | "sms" | (string & {})

/**
 * Attachment payload for channels that support file delivery, such as email.
 *
 * Use `contentBase64` when the caller already has the rendered bytes, or `path`
 * when the downstream provider can fetch the attachment from a URL/file path.
 */
export interface NotificationAttachment {
  /** User-visible file name. */
  filename: string
  /** Base64-encoded content for inline upload. */
  contentBase64?: string
  /** Provider-resolvable URL or path. */
  path?: string
  /** MIME type hint. */
  contentType?: string
  /** Optional disposition override. */
  disposition?: "attachment" | "inline"
  /** Optional inline content id. */
  contentId?: string
  /** Private attachment-store handle. Never a public URL or embedded credential. */
  privateHandle?: string
}

export interface QualifiedNotificationTargetRef {
  /** Package-qualified record kind, for example `@voyant-travel/conversations#thread`. */
  type: string
  id: string
}

export interface RenderedServiceMessageAttachment {
  privateHandle: string
  filename: string
  contentType?: string
  disposition?: "attachment" | "inline"
  contentId?: string
}

/** Provider-neutral, already-rendered service message admitted to the durable sender. */
export interface RenderedServiceMessage {
  channelAccountId: string
  channel?: "email" | "sms"
  to: string
  target: QualifiedNotificationTargetRef
  purpose: string
  idempotencyKey: string
  subject?: string
  text?: string
  sanitizedHtml?: string
  attachments?: ReadonlyArray<RenderedServiceMessageAttachment>
  thread?: {
    threadId?: string
    replyToDeliveryId?: string
  }
  organizationId?: string
  metadata?: Record<string, unknown>
}

export type NotificationDeliveryTruth =
  | "pending"
  | "accepted"
  | "delivered"
  | "failed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "cancelled"

export interface NormalizedNotificationDeliveryEvent {
  adapterRef: string
  adapterEventId: string
  deliveryId: string
  status: Exclude<NotificationDeliveryTruth, "pending">
  occurredAt: Date
  details?: Record<string, unknown>
}

export interface ChannelAccountDraft {
  channel: NotificationChannel
  address: string
  displayName: string
  allowedPurposes: ReadonlyArray<string>
  inboundCapable?: boolean
  outboundCapable?: boolean
}

export interface ProvisionedChannelAccount {
  adapterRef: string
  normalizedAddress: string
  displayAddress: string
}

export interface ValidatedChannelAccount {
  health: "healthy" | "degraded" | "unavailable"
  inboundCapable: boolean
  outboundCapable: boolean
  /** Required and unambiguous before an SMS identity can receive Inbox traffic. */
  inboundIdentity?: "unambiguous" | "ambiguous"
  /** Opaque ingress source id bound by the adapter to this receiving identity. */
  inboundSourceId?: string
  attachmentsCapable?: boolean
}

/** Runtime-only authority for provisioning and validating adapter identities. */
export interface ChannelAccountAdapterCapability {
  readonly protocol: "notification-channel-account-v1"
  matches(adapterRef: string): boolean
  provision(draft: ChannelAccountDraft): Promise<ProvisionedChannelAccount>
  validate(adapterRef: string): Promise<ValidatedChannelAccount>
}

/**
 * Payload describing a single notification to send. The `template` and
 * `data` fields are interpreted by the handling provider.
 */
export interface NotificationPayload {
  /** Recipient address (email address, phone number, channel id, ...). */
  to: string
  /** Channel this notification targets. */
  channel: NotificationChannel
  /** Optional provider hint when the caller wants a specific provider. */
  provider?: string
  /** Template identifier — interpretation is provider-specific. */
  template: string
  /** Data passed to the template for rendering. */
  data?: unknown
  /** Optional sender override. Providers may have their own defaults. */
  from?: string
  /** Optional subject line (email-only). */
  subject?: string
  /** Optional pre-rendered HTML body. */
  html?: string
  /** Optional pre-rendered text body. */
  text?: string
  /** Optional attachments for providers that support them. */
  attachments?: ReadonlyArray<NotificationAttachment>
}

/**
 * Result returned after a provider handles a send.
 */
export interface NotificationResult {
  /** Provider-assigned message/send id, if available. */
  id?: string
  /** Name of the provider that handled the send. */
  provider: string
}

export interface DurableNotificationDeliveryContext {
  /**
   * Stable across worker retries and process restarts. Providers must scope
   * this key to their account/tenant and reject payload drift.
   */
  idempotencyKey: string
}

export interface DurableNotificationDeliveryCapability {
  readonly protocol: "notification-provider-idempotency-v1"
  /**
   * Deliver once for this key. Repeating the same key and payload must return
   * the original provider result; key reuse with drift must reject.
   */
  send(
    payload: NotificationPayload,
    context: DurableNotificationDeliveryContext,
  ): Promise<NotificationResult>
}

/**
 * A pluggable notification provider. Implementations target one or more
 * channels and handle the actual delivery (HTTP call, SMTP, etc.).
 *
 * Provider packages implement this contract and expose it through the selected
 * `notifications.durable-provider` graph port. Notifications ships no
 * request-scoped or transport-specific provider implementation.
 */
export interface NotificationProvider {
  /** Unique adapter selection name. Kept internal to durable operation state. */
  readonly name: string
  /** Channels this provider can handle. */
  readonly channels: ReadonlyArray<NotificationChannel>
  /**
   * Default sender address/identifier used when a notification does not pass
   * an explicit `from`. Exposed so delivery logs can persist the resolved
   * sender before dispatch.
   */
  readonly defaultFromAddress?: string | null
  /** The only delivery mutation. Missing or malformed implementations fail closed. */
  readonly durableDelivery: DurableNotificationDeliveryCapability
  /** Optional runtime-only Channel Account provisioning/validation capability. */
  readonly channelAccounts?: ChannelAccountAdapterCapability
}

export type NotificationPrivateAttachmentResolver = ConversationPrivateAttachmentDeliveryResolver

import type { ConversationPrivateAttachmentDeliveryResolver } from "@voyant-travel/conversations-contracts"
