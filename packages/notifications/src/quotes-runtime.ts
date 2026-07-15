import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { QuotesNotificationsRuntime } from "@voyant-travel/quotes/runtime-port"

import { createNotificationService, notificationsService } from "./service.js"

/** Adapt Notifications delivery to Quotes' narrow, template-only proposal contract. */
export function createQuotesNotificationsRuntime(
  primitives: VoyantRuntimeHostPrimitives,
): QuotesNotificationsRuntime {
  return {
    async sendQuoteProposal(db, bindings, input) {
      const resolver = primitives.config.read(bindings, "notificationProviders")
      const providers = typeof resolver === "function" ? resolver(primitives.env(bindings)) : []
      const delivery = await notificationsService.sendNotification(
        db,
        createNotificationService(providers),
        {
          idempotencyKey: input.idempotencyKey,
          templateSlug: input.templateSlug,
          to: input.to,
          channel: input.channel,
          data: input.data,
          targetType: "other",
          targetId: input.quoteVersionId,
          metadata: {
            workflow: "quotes.snapshot-and-send",
            quoteId: input.quoteId,
            quoteVersionId: input.quoteVersionId,
          },
        },
      )
      if (!delivery) throw new Error("Notifications returned no quote proposal delivery")
      return {
        id: delivery.id,
        status: delivery.status,
        channel: delivery.channel,
        provider: delivery.provider,
        providerMessageId: delivery.providerMessageId,
        toAddress: delivery.toAddress,
      }
    },
  }
}
