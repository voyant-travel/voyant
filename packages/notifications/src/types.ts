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

/**
 * A pluggable notification provider. Implementations target one or more
 * channels and handle the actual delivery (HTTP call, SMTP, etc.).
 *
 * Built-in implementations:
 * - `createLocalProvider` — logs to console (dev/tests)
 * - `createVoyantCloudEmailProvider` — Voyant Cloud email API
 * - `createVoyantCloudSmsProvider` — Voyant Cloud SMS API
 *
 * Self-hosters who want to deliver via a different provider (raw Resend,
 * Twilio, SES, …) can implement this interface in their template.
 */
export interface NotificationProvider {
  /** Unique provider name (e.g. "resend", "local", "twilio"). */
  readonly name: string
  /** Channels this provider can handle. */
  readonly channels: ReadonlyArray<NotificationChannel>
  /**
   * Default sender address/identifier used when a notification does not pass
   * an explicit `from`. Exposed so delivery logs can persist the resolved
   * sender before dispatch.
   */
  readonly defaultFromAddress?: string | null
  /** Deliver the notification. Throws on failure. */
  send(payload: NotificationPayload): Promise<NotificationResult>
}
