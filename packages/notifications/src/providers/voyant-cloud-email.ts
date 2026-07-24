import type { VoyantCloudClient } from "@voyant-travel/cloud-sdk"

import type { NotificationAttachment, NotificationProvider, NotificationResult } from "../types.js"

export interface VoyantCloudEmailRendered {
  subject: string
  html?: string
  text?: string
}

export interface VoyantCloudEmailProviderOptions {
  /** Cloud SDK client. Construct via `getVoyantCloudClient(env)`. */
  client: VoyantCloudClient
  /** Default sender address. Payload `from` overrides. */
  from: string
  /** Optional default reply-to addresses. Payload may override per-send. */
  replyTo?: ReadonlyArray<string>
  /**
   * Render a template id + data tuple into an email body. When omitted,
   * the payload's `template` is used as the subject and `data` is
   * JSON-stringified into the text body.
   */
  renderTemplate?: (
    template: string,
    data: unknown,
  ) => Promise<VoyantCloudEmailRendered> | VoyantCloudEmailRendered
}

function mapAttachments(attachments: ReadonlyArray<NotificationAttachment> | undefined) {
  if (!attachments || attachments.length === 0) return undefined
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    ...(attachment.contentBase64 ? { content: attachment.contentBase64 } : {}),
    ...(attachment.path ? { path: attachment.path } : {}),
    ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
    ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
  }))
}

function attachEmailRequestContext(error: unknown, request: Record<string, unknown>) {
  if (!error || typeof error !== "object") return
  Object.defineProperty(error, "notificationRequest", {
    configurable: true,
    enumerable: true,
    value: request,
  })
}

function normalizeSenderAddress(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

/**
 * Notification provider that delivers email through the Voyant Cloud
 * `/email/v1/messages` endpoint.
 */
export function createVoyantCloudEmailProvider(
  options: VoyantCloudEmailProviderOptions,
): NotificationProvider {
  return {
    name: "voyant-cloud-email",
    channels: ["email"],
    defaultFromAddress: normalizeSenderAddress(options.from),
    durableDelivery: {
      supported: false,
      reason:
        "The current Voyant Cloud email client does not expose provider idempotency and reconciliation.",
    },
    async send(payload): Promise<NotificationResult> {
      if (payload.channel !== "email") {
        throw new Error(
          `Voyant Cloud email provider only supports the "email" channel, got "${payload.channel}"`,
        )
      }

      const rendered = options.renderTemplate
        ? await options.renderTemplate(payload.template, payload.data)
        : {
            subject: payload.subject ?? payload.template,
            text: JSON.stringify(payload.data ?? {}),
          }
      const attachments = mapAttachments(payload.attachments)
      const from = normalizeSenderAddress(payload.from) ?? normalizeSenderAddress(options.from)
      if (!from) {
        throw new Error(
          "Voyant Cloud email provider requires a sender address. Configure a verified email sender or pass `from`.",
        )
      }
      const request = {
        from,
        to: [payload.to],
        subject: payload.subject ?? rendered.subject,
        html: payload.html ?? rendered.html ?? null,
        text: payload.text ?? rendered.text ?? null,
        ...(attachments ? { attachments } : {}),
        ...(options.replyTo ? { replyTo: [...options.replyTo] } : {}),
      }

      let message: Awaited<ReturnType<typeof options.client.email.sendMessage>>
      try {
        message = await options.client.email.sendMessage(request)
      } catch (error) {
        attachEmailRequestContext(error, {
          from: request.from,
          to: request.to,
          replyTo: "replyTo" in request ? request.replyTo : null,
          subject: request.subject,
          attachmentCount: attachments?.length ?? 0,
          attachments:
            attachments?.map((attachment) => ({
              filename: attachment.filename,
              path: attachment.path ?? null,
              contentType: attachment.contentType ?? null,
              contentId: attachment.contentId ?? null,
              hasContent: Boolean(attachment.content),
            })) ?? [],
        })
        throw error
      }

      return { id: message.id, provider: "voyant-cloud-email" }
    },
  }
}
