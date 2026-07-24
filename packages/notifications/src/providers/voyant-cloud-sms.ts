import type { VoyantCloudClient } from "@voyant-travel/cloud-sdk"

import type { NotificationProvider, NotificationResult } from "../types.js"

export interface VoyantCloudSmsRendered {
  text: string
}

export interface VoyantCloudSmsProviderOptions {
  /** Cloud SDK client. Construct via `getVoyantCloudClient(env)`. */
  client: VoyantCloudClient
  /**
   * Default sender phone number. When omitted, the cloud account's default
   * shared number is used (server-side selection).
   */
  from?: string
  /**
   * Render a template id + data tuple into an SMS body. When omitted, the
   * payload's `text` field is used directly, falling back to a JSON dump of
   * `data`.
   */
  renderTemplate?: (
    template: string,
    data: unknown,
  ) => Promise<VoyantCloudSmsRendered> | VoyantCloudSmsRendered
}

/**
 * Notification provider that delivers SMS through the Voyant Cloud
 * `/sms/v1/messages` endpoint.
 */
export function createVoyantCloudSmsProvider(
  options: VoyantCloudSmsProviderOptions,
): NotificationProvider {
  return {
    name: "voyant-cloud-sms",
    channels: ["sms"],
    durableDelivery: {
      supported: false,
      reason:
        "The current Voyant Cloud SMS client does not expose provider idempotency and reconciliation.",
    },
    async send(payload): Promise<NotificationResult> {
      if (payload.channel !== "sms") {
        throw new Error(
          `Voyant Cloud SMS provider only supports the "sms" channel, got "${payload.channel}"`,
        )
      }

      const rendered = options.renderTemplate
        ? await options.renderTemplate(payload.template, payload.data)
        : { text: payload.text ?? JSON.stringify(payload.data ?? {}) }

      const message = await options.client.sms.sendMessage({
        to: payload.to,
        from: payload.from ?? options.from ?? null,
        body: payload.text ?? rendered.text,
      })

      return { id: message.id, provider: "voyant-cloud-sms" }
    },
  }
}
