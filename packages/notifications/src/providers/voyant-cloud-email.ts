import type { VoyantCloudClient } from "@voyantjs/cloud-sdk"

import type { NotificationProvider, NotificationResult } from "../types.js"

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

      const message = await options.client.email.sendMessage({
        from: payload.from ?? options.from,
        to: [payload.to],
        subject: payload.subject ?? rendered.subject,
        html: payload.html ?? rendered.html ?? null,
        text: payload.text ?? rendered.text ?? null,
        replyTo: options.replyTo ? [...options.replyTo] : null,
      })

      return { id: message.id, provider: "voyant-cloud-email" }
    },
  }
}
