import {
  createDefaultBookingDocumentAttachment,
  type NotificationsRuntimeProvider,
} from "@voyant-travel/notifications"

import { resolveNotificationProviders } from "../../lib/notifications.js"
import {
  readOperatorDocumentContentBase64,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./operator-runtime-adapter.js"
import { createNotificationsWorkflowRuntime } from "./operator-workflow-services.js"
import { resolvePublicCheckoutBaseUrlFromBindings } from "./payment-config.js"

/** Generic Node-host providers consumed through the Notifications runtime port. */
export function createOperatorNotificationsRuntimeProvider(): NotificationsRuntimeProvider {
  return {
    resolveProviders: resolveNotificationProviders,
    resolvePublicCheckoutBaseUrl: resolvePublicCheckoutBaseUrlFromBindings,
    resolveDocumentAttachmentResolver: (bindings) => async (document) => {
      if (document.storageKey) {
        const contentBase64 = await readOperatorDocumentContentBase64(bindings, document.storageKey)
        if (contentBase64) {
          return {
            filename: document.name,
            contentBase64,
            contentType: document.mimeType ?? undefined,
          }
        }
        const path = await resolveOperatorDocumentDownloadUrl(bindings, document.storageKey)
        if (path) {
          return {
            filename: document.name,
            path,
            contentType: document.mimeType ?? undefined,
          }
        }
      }
      return createDefaultBookingDocumentAttachment(document)
    },
    resolveDb: (bindings) => resolveOperatorDb(bindings),
    autoConfirmAndDispatch: {
      enabled: true,
      templateSlug: "booking-confirmation",
    },
    resolveReminderWorkflowRuntime: (bindings) =>
      createNotificationsWorkflowRuntime(bindings as AppBindings),
  }
}
